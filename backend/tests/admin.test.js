// Integration tests for the admin dashboard, transaction ledger, and account endpoints.
// Uses its own disposable database so it can run alongside the other test files.
const test = require('node:test');
const assert = require('node:assert');

process.env.NODE_ENV = 'test';
process.env.MONGO_URI =
  process.env.TEST_MONGO_URI_ADMIN || 'mongodb://127.0.0.1:27017/order_system_admin_test';
process.env.JWT_SECRET = 'test-secret';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_secret';
process.env.CLIENT_URL = 'http://localhost:3000';

const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Transaction = require('../models/Transaction');

let server;
let baseUrl;
let customer;
let other;
let admin;

const call = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

const register = async (name, email) =>
  (await call('/api/auth/register', { method: 'POST', body: { name, email, password: 'secret123' } }))
    .body.data;

test.before(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await mongoose.connection.dropDatabase();
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  customer = await register('Customer', 'customer@example.com');
  other = await register('Other', 'other@example.com');
  admin = await register('Admin', 'admin@example.com');
  await User.updateOne({ _id: admin._id }, { role: 'admin' });

  const product = await Product.create({
    name: 'Low Item',
    description: 'x',
    price: 1000,
    category: 'Tools',
    stockQuantity: 2,
  });

  const order = await Order.create({
    user: customer._id,
    orderItems: [{ product: product._id, name: 'Low Item', quantity: 1, price: 1000 }],
    shippingAddress: { street: '1 St', city: 'Lagos', state: 'Lagos', phone: '080' },
    totalAmount: 1000,
    paymentStatus: 'paid',
    status: 'processing',
  });

  await Transaction.create({
    order: order._id,
    user: customer._id,
    reference: 'ref-1',
    amount: 1000,
    status: 'success',
    paidAt: new Date(),
  });
  await Transaction.create({
    order: order._id,
    user: other._id,
    reference: 'ref-2',
    amount: 500,
    status: 'failed',
  });
});

test.after(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await new Promise((resolve) => server.close(resolve));
});

test('dashboard stats are admin-only', async () => {
  assert.strictEqual((await call('/api/admin/stats')).status, 401);
  assert.strictEqual((await call('/api/admin/stats', { token: customer.token })).status, 403);
});

test('dashboard stats report revenue, orders, low stock and a 14-day series', async () => {
  const res = await call('/api/admin/stats', { token: admin.token });
  assert.strictEqual(res.status, 200);

  const { data } = res.body;
  assert.strictEqual(data.revenue.allTime, 1000); // failed payment is excluded
  assert.strictEqual(data.revenue.last30Days, 1000);
  assert.strictEqual(data.orders.total, 1);
  assert.strictEqual(data.orders.byStatus.processing, 1);
  assert.strictEqual(data.customers, 2);
  assert.strictEqual(data.lowStock.length, 1);
  assert.strictEqual(data.dailyRevenue.length, 14);
  assert.strictEqual(data.dailyRevenue.reduce((sum, d) => sum + d.revenue, 0), 1000);
});

test('customers only see their own payment history; admins see all', async () => {
  const mine = await call('/api/transactions/my', { token: customer.token });
  assert.strictEqual(mine.status, 200);
  assert.deepStrictEqual(mine.body.data.map((t) => t.reference), ['ref-1']);

  assert.strictEqual((await call('/api/transactions', { token: customer.token })).status, 403);

  const all = await call('/api/transactions', { token: admin.token });
  assert.strictEqual(all.body.count, 2);

  const failed = await call('/api/transactions?status=failed', { token: admin.token });
  assert.deepStrictEqual(failed.body.data.map((t) => t.reference), ['ref-2']);
});

test('an order includes its confirmed payment for receipts, and only for its owner or an admin', async () => {
  const order = await Order.findOne();

  const owner = await call(`/api/orders/${order._id}`, { token: customer.token });
  assert.strictEqual(owner.status, 200);
  assert.strictEqual(owner.body.data.payment.reference, 'ref-1'); // the successful one, not the failed ref-2
  assert.strictEqual(owner.body.data.payment.amount, 1000);

  assert.strictEqual((await call(`/api/orders/${order._id}`, { token: admin.token })).status, 200);
  assert.strictEqual((await call(`/api/orders/${order._id}`, { token: other.token })).status, 403);
});

test('profile can be updated, but role cannot be changed through it', async () => {
  const res = await call('/api/auth/me', {
    method: 'PUT',
    token: customer.token,
    body: {
      name: 'Updated Name',
      phone: '08011112222',
      address: { street: '5 Road', city: 'Abuja', state: 'FCT' },
      role: 'admin',
    },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.name, 'Updated Name');
  assert.strictEqual(res.body.data.address.city, 'Abuja');
  assert.strictEqual(res.body.data.role, 'customer');
});

test('password change requires the current password and takes effect', async () => {
  const wrong = await call('/api/auth/me/password', {
    method: 'PUT',
    token: other.token,
    body: { currentPassword: 'nope-nope', newPassword: 'brand-new-pass' },
  });
  assert.strictEqual(wrong.status, 401);

  const weak = await call('/api/auth/me/password', {
    method: 'PUT',
    token: other.token,
    body: { currentPassword: 'secret123', newPassword: '123' },
  });
  assert.strictEqual(weak.status, 400);

  const ok = await call('/api/auth/me/password', {
    method: 'PUT',
    token: other.token,
    body: { currentPassword: 'secret123', newPassword: 'brand-new-pass' },
  });
  assert.strictEqual(ok.status, 200);

  const login = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'other@example.com', password: 'brand-new-pass' },
  });
  assert.strictEqual(login.status, 200);
});
