// Integration tests for ordering, stock handling, and payment settlement.
// They need a running MongoDB and use a separate, disposable database
// (override with TEST_MONGO_URI). Paystack itself is never called: payments
// are settled through the signed webhook, exactly as Paystack would send them.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/order_system_integration_test';
process.env.JWT_SECRET = 'test-secret';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_secret';
process.env.CLIENT_URL = 'http://localhost:3000';

const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Transaction = require('../models/Transaction');
const Order = require('../models/Order');

let server;
let baseUrl;
let customer;
let admin;
let product;

const call = async (path, { method = 'GET', body, token, headers = {} } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const shippingAddress = { street: '1 Test St', city: 'Lagos', state: 'Lagos', phone: '08000000000' };

const placeOrder = (token, quantity, productId = product._id) =>
  call('/api/orders', {
    method: 'POST',
    token,
    body: { orderItems: [{ product: productId, quantity }], shippingAddress },
  });

const stockOf = async () => (await Product.findById(product._id)).stockQuantity;

test.before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();

  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const register = async (name, email) =>
    (await call('/api/auth/register', { method: 'POST', body: { name, email, password: 'secret123' } }))
      .body.data;

  customer = await register('Customer', 'customer@example.com');
  const adminUser = await register('Admin', 'admin@example.com');
  await User.updateOne({ _id: adminUser._id }, { role: 'admin' });
  admin = adminUser;

  product = await Product.create({
    name: 'Test Widget',
    description: 'A widget',
    price: 2500,
    category: 'Tools',
    stockQuantity: 5,
  });
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await new Promise((resolve) => server.close(resolve));
});

test('registration never grants a role, and rejects operator-injection logins', async () => {
  const reg = await call('/api/auth/register', {
    method: 'POST',
    body: { name: 'Sneaky', email: 'sneaky@example.com', password: 'secret123', role: 'admin' },
  });
  assert.strictEqual(reg.status, 201);
  assert.strictEqual(reg.body.data.role, 'customer');

  const injected = await call('/api/auth/login', {
    method: 'POST',
    body: { email: { $gt: '' }, password: { $gt: '' } },
  });
  assert.strictEqual(injected.status, 401); // treated as a plain, wrong string - never as a query
});

test('order totals use database prices and reserve stock', async () => {
  const res = await call('/api/orders', {
    method: 'POST',
    token: customer.token,
    body: {
      orderItems: [{ product: product._id, quantity: 2, price: 1 }], // client price ignored
      shippingAddress,
    },
  });
  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.data.totalAmount, 5000);
  assert.strictEqual(await stockOf(), 3);
});

test('invalid quantities are rejected and leave stock untouched', async () => {
  for (const quantity of [-5, 0, 1.5, 'abc', 101]) {
    const res = await placeOrder(customer.token, quantity);
    assert.strictEqual(res.status, 400, `quantity ${quantity}`);
  }
  assert.strictEqual(await stockOf(), 3);
});

test('ordering more than available stock fails', async () => {
  const res = await placeOrder(customer.token, 4);
  assert.strictEqual(res.status, 400);
  assert.match(res.body.message, /Insufficient stock/);
  assert.strictEqual(await stockOf(), 3);
});

test('concurrent orders cannot oversell the last units', async () => {
  const results = await Promise.all([1, 2, 3, 4, 5, 6].map(() => placeOrder(customer.token, 1)));
  const created = results.filter((r) => r.status === 201).length;
  assert.strictEqual(created, 3); // exactly the 3 units that were left
  assert.strictEqual(await stockOf(), 0);
});

test('a failed multi-item order rolls back items it already reserved', async () => {
  const other = await Product.create({
    name: 'Scarce',
    description: 'x',
    price: 100,
    category: 'Tools',
    stockQuantity: 1,
  });
  const before = await Product.findById(other._id);
  await Product.updateOne({ _id: product._id }, { stockQuantity: 10 });

  const res = await call('/api/orders', {
    method: 'POST',
    token: customer.token,
    body: {
      orderItems: [
        { product: product._id, quantity: 2 },
        { product: other._id, quantity: 5 }, // fails: only 1 in stock
      ],
      shippingAddress,
    },
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(await stockOf(), 10); // first line was released again
  assert.strictEqual((await Product.findById(other._id)).stockQuantity, before.stockQuantity);
});

test('cancelling an unpaid order returns its stock; only the owner may cancel', async () => {
  const created = await placeOrder(customer.token, 3);
  assert.strictEqual(await stockOf(), 7);

  const stranger = await call('/api/auth/register', {
    method: 'POST',
    body: { name: 'Other', email: 'other@example.com', password: 'secret123' },
  });
  const denied = await call(`/api/orders/${created.body.data._id}/cancel`, {
    method: 'PUT',
    token: stranger.body.data.token,
  });
  assert.strictEqual(denied.status, 403);

  const cancelled = await call(`/api/orders/${created.body.data._id}/cancel`, {
    method: 'PUT',
    token: customer.token,
  });
  assert.strictEqual(cancelled.status, 200);
  assert.strictEqual(await stockOf(), 10);

  const again = await call(`/api/orders/${created.body.data._id}/cancel`, {
    method: 'PUT',
    token: customer.token,
  });
  assert.strictEqual(again.status, 400);
  assert.strictEqual(await stockOf(), 10); // not double-restored
});

test('customers cannot read other people\'s orders or admin endpoints', async () => {
  const order = await Order.findOne();
  const other = (
    await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'other@example.com', password: 'secret123' },
    })
  ).body.data;

  assert.strictEqual((await call(`/api/orders/${order._id}`, { token: other.token })).status, 403);
  assert.strictEqual((await call('/api/orders', { token: customer.token })).status, 403);
  assert.strictEqual((await call('/api/orders', { token: admin.token })).status, 200);
});

test('product updates ignore non-whitelisted fields; search treats input literally', async () => {
  const res = await call(`/api/products/${product._id}`, {
    method: 'PUT',
    token: admin.token,
    body: { price: 3000, __v: 99, createdAt: '2000-01-01' },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.price, 3000);
  assert.notStrictEqual(res.body.data.createdAt, new Date('2000-01-01').toISOString());

  const search = await call('/api/products?search=' + encodeURIComponent('.*'));
  assert.strictEqual(search.status, 200);
  assert.strictEqual(search.body.count, 0); // ".*" is matched literally, not as a regex
});

test('webhook settles a payment once, rejects amount mismatches, and is idempotent', async () => {
  const created = await placeOrder(customer.token, 1);
  const order = await Order.findById(created.body.data._id);

  const sendEvent = (reference, amountKobo) => {
    const body = JSON.stringify({
      event: 'charge.success',
      data: { reference, status: 'success', amount: amountKobo, channel: 'card' },
    });
    const signature = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(body)
      .digest('hex');
    return call('/api/transactions/webhook', {
      method: 'POST',
      body,
      headers: { 'x-paystack-signature': signature },
    });
  };

  // Underpayment: must not mark the order as paid.
  const bad = await Transaction.create({
    order: order._id,
    user: customer._id,
    reference: 'ref-underpaid',
    amount: order.totalAmount,
  });
  assert.strictEqual((await sendEvent('ref-underpaid', 100)).status, 200);
  assert.strictEqual((await Transaction.findById(bad._id)).status, 'failed');
  assert.strictEqual((await Order.findById(order._id)).paymentStatus, 'pending');

  // Correct payment: order becomes paid and moves to processing.
  await Transaction.create({
    order: order._id,
    user: customer._id,
    reference: 'ref-good',
    amount: order.totalAmount,
  });
  const kobo = order.totalAmount * 100;
  assert.strictEqual((await sendEvent('ref-good', kobo)).status, 200);
  let settled = await Order.findById(order._id);
  assert.strictEqual(settled.paymentStatus, 'paid');
  assert.strictEqual(settled.status, 'processing');

  // Replayed event changes nothing.
  assert.strictEqual((await sendEvent('ref-good', kobo)).status, 200);
  settled = await Order.findById(order._id);
  assert.strictEqual(settled.paymentStatus, 'paid');

  // Paid orders can't be self-cancelled.
  const cancel = await call(`/api/orders/${order._id}/cancel`, { method: 'PUT', token: customer.token });
  assert.strictEqual(cancel.status, 400);
});

test('only the owner (or an admin) can verify a transaction', async () => {
  const other = (
    await call('/api/auth/login', {
      method: 'POST',
      body: { email: 'other@example.com', password: 'secret123' },
    })
  ).body.data;
  const res = await call('/api/transactions/verify/ref-good', { token: other.token });
  assert.strictEqual(res.status, 403);
});
