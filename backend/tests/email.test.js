// Unit tests for the email module. The network is stubbed, so nothing is sent.
const test = require('node:test');
const assert = require('node:assert');

process.env.CLIENT_URL = 'http://localhost:3000';

const email = require('../utils/email');

const sampleOrder = {
  _id: '6ab6728f393ef9506cca68f3',
  status: 'shipped',
  totalAmount: 35000,
  orderItems: [
    { name: 'Running <b>Sneakers</b>', quantity: 1, price: 27500 },
    { name: 'LED Desk Lamp', quantity: 1, price: 7500 },
  ],
};

const withFetch = async (stub, run) => {
  const original = global.fetch;
  global.fetch = stub;
  try {
    return await run();
  } finally {
    global.fetch = original;
  }
};

test.afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_FROM;
});

test('without an API key, emails are skipped (logged) and never throw', async () => {
  let called = false;
  const result = await withFetch(
    async () => {
      called = true;
    },
    () => email.sendEmail({ to: 'a@example.com', subject: 'Hi', html: '<p>x</p>' })
  );

  assert.strictEqual(email.emailEnabled(), false);
  assert.deepStrictEqual(result, { sent: false, skipped: true });
  assert.strictEqual(called, false);
});

test('with an API key, the Resend API is called with the right payload', async () => {
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'Shop <orders@example.com>';

  let request;
  const result = await withFetch(
    async (url, options) => {
      request = { url, options, body: JSON.parse(options.body) };
      return { ok: true };
    },
    () => email.sendPasswordReset({ to: 'ada@example.com', name: 'Ada', resetUrl: 'http://x/reset/abc' })
  );

  assert.strictEqual(result.sent, true);
  assert.strictEqual(request.url, 'https://api.resend.com/emails');
  assert.strictEqual(request.options.headers.Authorization, 'Bearer re_test_key');
  assert.strictEqual(request.body.from, 'Shop <orders@example.com>');
  assert.deepStrictEqual(request.body.to, ['ada@example.com']);
  assert.match(request.body.html, /http:\/\/x\/reset\/abc/);
  assert.match(request.body.html, /Hi Ada/);
});

test('a provider failure is reported but does not throw', async () => {
  process.env.RESEND_API_KEY = 're_test_key';

  const rejected = await withFetch(
    async () => ({ ok: false, status: 403, text: async () => 'domain not verified' }),
    () => email.sendEmail({ to: 'a@example.com', subject: 'Hi', html: '<p>x</p>' })
  );
  assert.strictEqual(rejected.sent, false);

  const offline = await withFetch(
    async () => {
      throw new Error('network down');
    },
    () => email.sendEmail({ to: 'a@example.com', subject: 'Hi', html: '<p>x</p>' })
  );
  assert.strictEqual(offline.sent, false);
});

test('customer-supplied text is HTML-escaped in templates', async () => {
  process.env.RESEND_API_KEY = 're_test_key';

  let html = '';
  await withFetch(
    async (url, options) => {
      html = JSON.parse(options.body).html;
      return { ok: true };
    },
    () =>
      email.sendPaymentReceived({
        to: 'a@example.com',
        name: '<script>alert(1)</script>',
        order: sampleOrder,
      })
  );

  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<b>Sneakers</b>'));
  assert.match(html, /&lt;b&gt;Sneakers&lt;\/b&gt;/);
  assert.match(html, /₦35,000/);
  assert.match(html, /#CCA68F3|#6CCA68F3/);
});

test('only shipped, delivered and cancelled statuses trigger a status email', async () => {
  process.env.RESEND_API_KEY = 're_test_key';

  let calls = 0;
  const stub = async () => {
    calls += 1;
    return { ok: true };
  };

  await withFetch(stub, async () => {
    await email.sendOrderStatusUpdate({ to: 'a@example.com', name: 'A', order: { ...sampleOrder, status: 'processing' } });
    await email.sendOrderStatusUpdate({ to: 'a@example.com', name: 'A', order: { ...sampleOrder, status: 'pending' } });
    assert.strictEqual(calls, 0);

    await email.sendOrderStatusUpdate({ to: 'a@example.com', name: 'A', order: { ...sampleOrder, status: 'shipped' } });
    await email.sendOrderStatusUpdate({ to: 'a@example.com', name: 'A', order: { ...sampleOrder, status: 'delivered' } });
    await email.sendOrderStatusUpdate({ to: 'a@example.com', name: 'A', order: { ...sampleOrder, status: 'cancelled' } });
    assert.strictEqual(calls, 3);
  });
});
