const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');
const { reserveStock, releaseStock } = require('../utils/stock');
const User = require('../models/User');
const { sendOrderStatusUpdate } = require('../utils/email');

/**
 * @desc    Create a new order
 * @route   POST /api/orders
 * @access  Private
 *
 * Expected request body:
 * {
 *   "orderItems": [{ "product": "<productId>", "quantity": 2 }, ...],
 *   "shippingAddress": { "street", "city", "state", "phone" }
 * }
 *
 * Product names/prices are NOT trusted from the client - they are looked
 * up fresh from the database here, so a user can't tamper with prices by
 * editing the request body.
 */
const createOrder = asyncHandler(async (req, res) => {
  const { orderItems, shippingAddress } = req.body;

  if (!Array.isArray(orderItems) || orderItems.length === 0) {
    res.status(400);
    throw new Error('No order items provided');
  }

  if (
    !shippingAddress ||
    !shippingAddress.street ||
    !shippingAddress.city ||
    !shippingAddress.state ||
    !shippingAddress.phone
  ) {
    res.status(400);
    throw new Error('Please provide a complete shipping address');
  }

  // Validate and merge line items. Quantities must be positive integers;
  // duplicate product ids are combined so stock is checked against the total.
  const merged = new Map();
  for (const item of orderItems) {
    const quantity = Number(item?.quantity);
    const productId = String(item?.product ?? '');

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400);
      throw new Error(`Invalid product id: ${productId}`);
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      res.status(400);
      throw new Error('Quantity must be a whole number between 1 and 100');
    }
    merged.set(productId, (merged.get(productId) || 0) + quantity);
  }

  // Names and prices come from the database, never from the client.
  // Stock is reserved atomically so concurrent orders cannot oversell.
  let reserved;
  try {
    reserved = await reserveStock(
      [...merged].map(([product, quantity]) => ({ product, quantity }))
    );
  } catch (error) {
    res.status(error.statusCode || 500);
    throw error;
  }

  const finalOrderItems = reserved.map(({ product, name, quantity, price }) => ({
    product,
    name,
    quantity,
    price,
  }));
  const totalAmount = finalOrderItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  let order;
  try {
    order = await Order.create({
      user: req.user._id,
      orderItems: finalOrderItems,
      shippingAddress: {
        street: String(shippingAddress.street).trim(),
        city: String(shippingAddress.city).trim(),
        state: String(shippingAddress.state).trim(),
        phone: String(shippingAddress.phone).trim(),
      },
      totalAmount,
    });
  } catch (error) {
    await releaseStock(reserved);
    throw error;
  }
  res.status(201).json({
    success: true,
    data: order,
  });
});

/**
 * @desc    Get all orders belonging to the logged-in user
 * @route   GET /api/orders/my-orders
 * @access  Private
 */
const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({ user: req.user._id }).sort({
    createdAt: -1,
  });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

/**
 * @desc    Get a single order by id
 * @route   GET /api/orders/:id
 * @access  Private (owner of the order, or an admin)
 */
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    'user',
    'name email'
  );

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // Only the order's owner or an admin may view it.
  const isOwner = order.user._id.toString() === req.user._id.toString();
  if (!isOwner && req.user.role !== 'admin') {
    res.status(403);
    throw new Error('Not authorized to view this order');
  }

  // Attach the confirmed payment (if any) so receipts can show how it was paid.
  const payment = await Transaction.findOne({ order: order._id, status: 'success' }).select(
    'reference paymentMethod paidAt amount'
  );

  res.status(200).json({
    success: true,
    data: { ...order.toObject(), payment },
  });
});

/**
 * @desc    Get all orders in the system
 * @route   GET /api/orders
 * @access  Private/Admin
 */
const getOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find({})
    .populate('user', 'name email')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: orders.length,
    data: orders,
  });
});

/**
 * @desc    Update an order's status (e.g. processing, shipped, delivered)
 * @route   PUT /api/orders/:id/status
 * @access  Private/Admin
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const validStatuses = [
    'pending',
    'processing',
    'shipped',
    'delivered',
    'cancelled',
  ];

  if (!status || !validStatuses.includes(status)) {
    res.status(400);
    throw new Error(`Status must be one of: ${validStatuses.join(', ')}`);
  }

  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.status === 'cancelled' && status !== 'cancelled') {
    res.status(400);
    throw new Error('A cancelled order cannot be reopened - place a new order instead');
  }

  if (status === 'cancelled' && order.status !== 'cancelled') {
    await releaseStock(order.orderItems);
  }

  const previousStatus = order.status;
  order.status = status;
  const updatedOrder = await order.save();

  if (status !== previousStatus) {
    const customer = await User.findById(order.user).select('name email');
    if (customer) sendOrderStatusUpdate({ to: customer.email, name: customer.name, order: updatedOrder });
  }

  res.status(200).json({
    success: true,
    data: updatedOrder,
  });
});

/**
 * @desc    Cancel an order (customer-initiated)
 * @route   PUT /api/orders/:id/cancel
 * @access  Private (owner of the order only)
 *
 * Only unpaid orders can be self-cancelled. Once payment has succeeded,
 * cancelling requires an admin (since it may involve a refund process
 * outside the scope of this system).
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.user.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized to cancel this order');
  }

  if (order.paymentStatus === 'paid') {
    res.status(400);
    throw new Error('Paid orders cannot be self-cancelled - please contact support');
  }

  if (order.status === 'cancelled') {
    res.status(400);
    throw new Error('This order is already cancelled');
  }

  await releaseStock(order.orderItems);
  order.status = 'cancelled';
  const updatedOrder = await order.save();

  res.status(200).json({
    success: true,
    data: updatedOrder,
  });
});

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  getOrders,
  updateOrderStatus,
  cancelOrder,
};