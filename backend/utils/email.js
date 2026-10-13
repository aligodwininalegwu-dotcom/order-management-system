/**
 * Transactional email.
 *
 * Sends through Resend (https://resend.com) when RESEND_API_KEY is set.
 * Without a key, emails are printed to the server console instead, so the
 * app works end to end in development and nothing ever fails because email
 * is not configured yet.
 *
 * Sending is always "fire and forget" from the caller's point of view: a
 * failed email is logged but never breaks an order or payment.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 15000;

const BRAND = {
  name: 'Online Store',
  navy: '#131c3a',
  gold: '#bf9a55',
  ink: '#0e1322',
  muted: '#74777c',
};

const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

const naira = (amount) => `₦${Number(amount || 0).toLocaleString('en-NG')}`;

/** Wraps message content in a simple, branded, email-client-safe layout. */
const layout = ({ heading, intro, bodyHtml = '', button }) => `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8f6f1;font-family:Arial,Helvetica,sans-serif;color:${BRAND.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e8e4db;">
          <tr><td style="background:${BRAND.navy};padding:22px 28px;color:#e8cf98;font-size:22px;font-family:Georgia,serif;">${BRAND.name}</td></tr>
          <tr><td style="padding:32px 28px 8px;">
            <h1 style="margin:0 0 12px;font-size:24px;font-family:Georgia,serif;font-weight:normal;">${escapeHtml(heading)}</h1>
            <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#434859;">${intro}</p>
            ${bodyHtml}
            ${
              button
                ? `<p style="margin:28px 0 8px;"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:${BRAND.gold};color:#1a1407;text-decoration:none;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:999px;">${escapeHtml(button.label)}</a></p>`
                : ''
            }
          </td></tr>
          <tr><td style="padding:24px 28px 30px;font-size:12px;color:${BRAND.muted};">This is an automated message from ${BRAND.name}.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

const itemsTable = (order) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-top:1px solid #e8e4db;">
    ${order.orderItems
      .map(
        (item) => `<tr>
          <td style="padding:10px 0;border-bottom:1px solid #e8e4db;font-size:14px;">${escapeHtml(item.name)} × ${item.quantity}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid #e8e4db;font-size:14px;">${naira(item.price * item.quantity)}</td>
        </tr>`
      )
      .join('')}
    <tr>
      <td style="padding:12px 0;font-size:15px;font-weight:bold;">Total</td>
      <td align="right" style="padding:12px 0;font-size:15px;font-weight:bold;">${naira(order.totalAmount)}</td>
    </tr>
  </table>`;

const orderRef = (order) => `#${String(order._id).slice(-8).toUpperCase()}`;
const orderUrl = (order) => `${process.env.CLIENT_URL}/orders/${order._id}`;

/** Low-level send. Resolves to { sent, skipped?, error? } and never throws. */
const sendEmail = async ({ to, subject, html }) => {
  if (!to) return { sent: false, error: 'no recipient' };

  if (!emailEnabled()) {
    console.info(`[email:dev] To: ${to} | Subject: ${subject}`);
    return { sent: false, skipped: true };
  }

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || `${BRAND.name} <onboarding@resend.dev>`,
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`Email to ${to} failed (${response.status}): ${detail.slice(0, 300)}`);
      return { sent: false, error: `status ${response.status}` };
    }
    return { sent: true };
  } catch (error) {
    console.error(`Email to ${to} failed: ${error.cause?.code || error.message}`);
    return { sent: false, error: error.message };
  }
};

const sendPasswordReset = ({ to, name, resetUrl }) =>
  sendEmail({
    to,
    subject: 'Reset your password',
    html: layout({
      heading: 'Reset your password',
      intro: `Hi ${escapeHtml(name || 'there')}, we received a request to reset your password. This link works for 30 minutes. If you didn't ask for this, you can safely ignore this email.`,
      button: { label: 'Choose a new password', url: resetUrl },
    }),
  });

const sendPaymentReceived = ({ to, name, order }) =>
  sendEmail({
    to,
    subject: `Payment received for order ${orderRef(order)}`,
    html: layout({
      heading: 'Thank you, payment received',
      intro: `Hi ${escapeHtml(name || 'there')}, your payment for order <strong>${orderRef(order)}</strong> was confirmed and we are now preparing it.`,
      bodyHtml: itemsTable(order),
      button: { label: 'Track your order', url: orderUrl(order) },
    }),
  });

const STATUS_COPY = {
  shipped: { subject: 'is on its way', heading: 'Your order has shipped', intro: 'is on its way to you.' },
  delivered: { subject: 'was delivered', heading: 'Your order was delivered', intro: 'has been delivered. We hope you enjoy it.' },
  cancelled: { subject: 'was cancelled', heading: 'Your order was cancelled', intro: 'has been cancelled and the reserved items were returned to stock.' },
};

/** Only statuses a customer cares about trigger an email. */
const sendOrderStatusUpdate = ({ to, name, order }) => {
  const copy = STATUS_COPY[order.status];
  if (!copy) return Promise.resolve({ sent: false, skipped: true });

  return sendEmail({
    to,
    subject: `Order ${orderRef(order)} ${copy.subject}`,
    html: layout({
      heading: copy.heading,
      intro: `Hi ${escapeHtml(name || 'there')}, your order <strong>${orderRef(order)}</strong> ${copy.intro}`,
      bodyHtml: itemsTable(order),
      button: { label: 'View order', url: orderUrl(order) },
    }),
  });
};

module.exports = {
  emailEnabled,
  sendEmail,
  sendPasswordReset,
  sendPaymentReceived,
  sendOrderStatusUpdate,
  escapeHtml,
};
