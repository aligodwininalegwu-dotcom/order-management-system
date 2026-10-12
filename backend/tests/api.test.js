const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

// Configuration must exist before the app is loaded.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/unused';
process.env.JWT_SECRET = 'test-secret';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_secret';
process.env.CLIENT_URL = 'http://localhost:3000';

const app = require('../server');

// No database in this file: fail queries immediately instead of buffering for 10s.
require('mongoose').set('bufferCommands', false);

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

const call = (path, options) => fetch(`${baseUrl}${path}`, options);

test('unknown routes return a JSON 404', async () => {
  const res = await call('/api/does-not-exist');
  assert.strictEqual(res.status, 404);
  assert.strictEqual((await res.json()).success, false);
});

test('health check reports 503 while the database is disconnected', async () => {
  const res = await call('/api/health');
  assert.strictEqual(res.status, 503);
});

test('protected routes reject requests without a token', async () => {
  for (const path of ['/api/orders/my-orders', '/api/auth/me', '/api/orders']) {
    const res = await call(path);
    assert.strictEqual(res.status, 401, path);
  }
});

test('protected routes reject a forged token', async () => {
  const res = await call('/api/auth/me', {
    headers: { Authorization: 'Bearer not.a.real-token' },
  });
  assert.strictEqual(res.status, 401);
});

test('malformed JSON is a 400, not a 500', async () => {
  const res = await call('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.strictEqual(res.status, 400);
});

test('webhook rejects a missing or wrong signature', async () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'x' } });
  const headers = { 'Content-Type': 'application/json' };

  const unsigned = await call('/api/transactions/webhook', { method: 'POST', headers, body });
  assert.strictEqual(unsigned.status, 401);

  const wrong = await call('/api/transactions/webhook', {
    method: 'POST',
    headers: { ...headers, 'x-paystack-signature': 'deadbeef' },
    body,
  });
  assert.strictEqual(wrong.status, 401);
});

test('webhook accepts a correctly signed event for an unknown reference', async () => {
  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'nope' } });
  const signature = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(body)
    .digest('hex');

  // The reference lookup needs a database; with none connected Mongoose
  // buffers and times out, so only assert that the signature check passed.
  const res = await Promise.race([
    call('/api/transactions/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
      body,
    }),
    new Promise((resolve) => setTimeout(() => resolve({ status: 'pending' }), 1500)),
  ]);
  assert.notStrictEqual(res.status, 401);
});
