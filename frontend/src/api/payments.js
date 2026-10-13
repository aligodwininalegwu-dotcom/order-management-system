import { api } from './client';

/**
 * Starts (or restarts) payment for an existing order and sends the browser
 * to Paystack's hosted checkout. Used for "Pay now" on unpaid orders.
 */
export async function payForOrder(orderId) {
  const res = await api.post('/transactions/initialize', { orderId });
  window.location.href = res.data.authorization_url;
}
