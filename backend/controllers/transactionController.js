const crypto = require('crypto');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { sendPaymentReceived } = require('../utils/email');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_TIMEOUT_MS = 20000;
const PAYSTACK_ATTEMPTS = 3;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls the Paystack API with a timeout and a consistent error shape.
 * Connection-level failures (DNS hiccups, resets, timeouts) are retried a
 * couple of times, since they are usually momentary on flaky networks.
 */
const paystackRequest = async (path, options = {}) => {
  let response;

  for (let attempt = 1; attempt <= PAYSTACK_ATTEMPTS; attempt += 1) {
    try {
      response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        signal: AbortSignal.timeout(PAYSTACK_TIMEOUT_MS),
      });
      break;
    } catch (error) {
      const reason = error.cause?.code || error.name || error.message;
      console.error(`Paystack ${path} attempt ${attempt}/${PAYSTACK_ATTEMPTS} failed: ${reason}`);

      if (attempt === PAYSTACK_ATTEMPTS) {
        const err = new Error(
          'Could not reach Paystack. Please check your internet connection and try again.'
        );
        err.statusCode = 502;
        throw err;
      }
      await wait(500 * attempt);
    }
  }

  const body = await response.json().catch(() => ({}));

  if (!body.status) {
    const err = new Error(`Paystack request failed: ${body.message || response.statusText}`);
    err.statusCode = 502;
    throw err;
  }

  return body.data;
};

/**
 * Applies a Paystack payment result to our Transaction and Order records.
 * Shared by the verify endpoint and the webhook, and safe to run more than
 * once for the same payment (Paystack retries webhooks, and the customer's
 * browser may call verify as well).
 */
const settleTransaction = async (transaction, paymentData) => {
  // A successful payment is final - never let a late, stale event undo it.
  if (transaction.status === 'success') {
    return transaction;
  }

  if (paymentData.status === 'success') {
    // Guard against a payment that doesn't match what we asked Paystack to charge.
    const expectedKobo = Math.round(transaction.amount * 100);
    if (paymentData.amount !== expectedKobo) {
      transaction.status = 'failed';
      transaction.paystackResponse = paymentData;
      await transaction.save();
      console.error(
        `Amount mismatch on ${transaction.reference}: expected ${expectedKobo}, got ${paymentData.amount}`
      );
      return transaction;
    }

    transaction.status = 'success';
    transaction.paymentMethod = paymentData.channel || '';
    transaction.paystackResponse = paymentData;
    transaction.paidAt = paymentData.paid_at ? new Date(paymentData.paid_at) : new Date();
    await transaction.save();

    const order = await Order.findById(transaction.order);
    if (order) {
      order.paymentStatus = 'paid';
      if (order.status === 'pending') {
        order.status = 'processing'; // Move the order forward now that it's paid
      }
      await order.save();

      // Settling only happens once per payment, so this sends a single email.
      const customer = await User.findById(transaction.user).select('name email');
      if (customer) sendPaymentReceived({ to: customer.email, name: customer.name, order });
    }
  } else if (['failed', 'abandoned', 'reversed'].includes(paymentData.status)) {
    transaction.status = 'failed';
    transaction.paystackResponse = paymentData;
    await transaction.save();
  }
  // Any other status (e.g. "ongoing") means the customer is still paying.

  return transaction;
};

/**
 * @desc    Initialize a Paystack transaction for an order
 * @route   POST /api/transactions/initialize
 * @access  Private
 *
 * Expected request body: { "orderId": "<order _id>" }
 *
 * This does NOT charge the customer directly. Paystack returns an
 * "authorization_url" - a hosted checkout page. The customer is sent
 * there to enter card/bank details, and Paystack redirects them back
 * afterward. We separately verify the payment succeeded (see below).
 */
const initializeTransaction = asyncHandler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId || !mongoose.isValidObjectId(orderId)) {
    res.status(400);
    throw new Error('Please provide a valid orderId');
  }

  const order = await Order.findById(orderId);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Only the order's owner can pay for it.
  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to pay for this order');
  }

  if (order.paymentStatus === 'paid') {
    res.status(400);
    throw new Error('This order has already been paid for');
  }

  if (order.status === 'cancelled') {
    res.status(400);
    throw new Error('A cancelled order cannot be paid for');
  }

  // Paystack expects amounts in kobo (the smallest currency unit for NGN),
  // so multiply the Naira amount by 100.
  const amountInKobo = Math.round(order.totalAmount * 100);

  const data = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: req.user.email,
      amount: amountInKobo,
      callback_url: `${process.env.CLIENT_URL}/payment/callback`,
      metadata: {
        orderId: order._id.toString(),
        userId: req.user._id.toString(),
      },
    }),
  });

  // Create our own Transaction record right away, in "pending" status,
  // using the reference Paystack generated. This lets us track the
  // attempt even before the customer finishes paying.
  const transaction = await Transaction.create({
    order: order._id,
    user: req.user._id,
    reference: data.reference,
    amount: order.totalAmount,
    status: 'pending',
  });

  order.transaction = transaction._id;
  await order.save();

  res.status(200).json({
    success: true,
    data: {
      authorization_url: data.authorization_url,
      reference: data.reference,
    },
  });
});

/**
 * @desc    Verify a Paystack transaction and update the order accordingly
 * @route   GET /api/transactions/verify/:reference
 * @access  Private (owner of the transaction, or an admin)
 *
 * Call this after the customer completes (or abandons) checkout on
 * Paystack's page. It asks Paystack directly whether the payment actually
 * succeeded - never trust a "success" claim from the frontend alone.
 */
const verifyTransaction = asyncHandler(async (req, res) => {
  const reference = String(req.params.reference);

  const transaction = await Transaction.findOne({ reference });

  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  const isOwner = transaction.user.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this transaction');
  }

  const paymentData = await paystackRequest(
    `/transaction/verify/${encodeURIComponent(reference)}`
  );

  await settleTransaction(transaction, paymentData);

  res.status(200).json({
    success: true,
    data: {
      status: transaction.status,
      reference: transaction.reference,
      amount: transaction.amount,
    },
  });
});

/**
 * @desc    Receive Paystack webhook events (e.g. charge.success)
 * @route   POST /api/transactions/webhook
 * @access  Public, authenticated by HMAC signature
 *
 * Needs the raw request body, because the signature is computed over the
 * exact bytes Paystack sent. It is mounted with express.raw() in server.js.
 * This keeps orders accurate even if the customer closes the browser before
 * returning from Paystack.
 */
const handleWebhook = asyncHandler(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const expected = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(req.body)
    .digest('hex');

  const valid =
    typeof signature === 'string' &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!valid) {
    res.status(401);
    throw new Error('Invalid webhook signature');
  }

  const event = JSON.parse(req.body.toString('utf8'));

  if (event.event === 'charge.success' && event.data?.reference) {
    const transaction = await Transaction.findOne({ reference: event.data.reference });
    if (transaction) {
      await settleTransaction(transaction, event.data);
    }
  }

  // Always acknowledge a validly signed event so Paystack stops retrying.
  res.status(200).json({ success: true });
});

/**
 * @desc    Get the logged-in user's payment history
 * @route   GET /api/transactions/my
 * @access  Private
 */
const getMyTransactions = asyncHandler(async (req, res) => {
  const transactions = await Transaction.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .select('-paystackResponse')
    .populate('order', 'totalAmount status orderItems');

  res.status(200).json({ success: true, count: transactions.length, data: transactions });
});

/**
 * @desc    Get every transaction (optionally filtered by ?status=)
 * @route   GET /api/transactions
 * @access  Private/Admin
 */
const getAllTransactions = asyncHandler(async (req, res) => {
  const query = {};
  if (['pending', 'success', 'failed'].includes(req.query.status)) {
    query.status = req.query.status;
  }

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .limit(500)
    .select('-paystackResponse')
    .populate('user', 'name email')
    .populate('order', 'status');

  res.status(200).json({ success: true, count: transactions.length, data: transactions });
});

module.exports = {
  initializeTransaction,
  verifyTransaction,
  handleWebhook,
  getMyTransactions,
  getAllTransactions,
};
