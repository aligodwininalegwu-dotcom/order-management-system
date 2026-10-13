import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { payForOrder } from '../api/payments';
import { formatDate, formatNaira } from '../utils/format';

// The journey of an order, in sequence. A step is "done" once the order
// has reached it; cancelled orders stop after the first step.
const STEPS = [
  { key: 'placed', label: 'Order placed', hint: 'We received your order' },
  { key: 'paid', label: 'Payment confirmed', hint: 'Your payment was verified' },
  { key: 'processing', label: 'Processing', hint: 'We are preparing your items' },
  { key: 'shipped', label: 'Shipped', hint: 'On its way to you' },
  { key: 'delivered', label: 'Delivered', hint: 'Enjoy your purchase' },
];

function progressOf(order) {
  if (order.status === 'cancelled') return 1;
  if (order.status === 'delivered') return 5;
  if (order.status === 'shipped') return 4;
  if (order.status === 'processing') return 3;
  return order.paymentStatus === 'paid' ? 2 : 1;
}

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/orders/${id}`, { signal: controller.signal });
        setOrder(res.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [id]);

  const handlePay = async () => {
    setBusy(true);
    setError('');
    try {
      await payForOrder(order._id);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    try {
      await api.put(`/orders/${order._id}/cancel`);
      setOrder({ ...order, status: 'cancelled' });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page page-loading" role="status">
        <span className="spinner" />
        <span className="visually-hidden">Loading order…</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1>Order not found</h1>
          <p>{error || 'This order does not exist or belongs to another account.'}</p>
          <Link to="/orders">
            <button type="button" tabIndex={-1}>
              Back to my orders
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const progress = progressOf(order);
  const cancelled = order.status === 'cancelled';
  const unpaid = order.paymentStatus !== 'paid' && !cancelled;

  return (
    <div className="page">
      <Link to="/orders" className="back-link">
        <span aria-hidden="true">←</span> All orders
      </Link>

      <div className="page-heading">
        <div>
          <h1>Order #{order._id.slice(-8).toUpperCase()}</h1>
          <p>Placed on {formatDate(order.createdAt)}</p>
        </div>
        <span className={`order-status-badge status-${order.status}`}>{order.status}</span>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      <section className="panel timeline-panel" aria-label="Order progress">
        {cancelled && (
          <p className="timeline-banner">This order was cancelled. Reserved items were returned to stock.</p>
        )}
        <ol className="timeline">
          {STEPS.map((step, index) => {
            const state = index < progress ? 'done' : index === progress && !cancelled ? 'current' : 'todo';
            return (
              <li key={step.key} className={`timeline-step is-${state}`}>
                <span className="timeline-dot" aria-hidden="true">
                  {state === 'done' ? '✓' : index + 1}
                </span>
                <div>
                  <strong>{step.label}</strong>
                  <span>{step.hint}</span>
                </div>
              </li>
            );
          })}
        </ol>

        {unpaid && (
          <div className="timeline-cta">
            <p>Your items are reserved for you. Complete payment to start processing.</p>
            <button type="button" className="btn-accent" onClick={handlePay} disabled={busy}>
              {busy ? 'Please wait…' : `Pay ${formatNaira(order.totalAmount)} now`}
            </button>
          </div>
        )}
      </section>

      <div className="layout-split detail-split">
        <section className="panel" aria-label="Items">
          <h2>Items</h2>
          <div className="order-items-list detail-items">
            {order.orderItems.map((item) => (
              <div key={item.product} className="order-item-row">
                <Link to={`/products/${item.product}`} className="order-item-thumb" aria-hidden="true" tabIndex={-1}>
                  {item.name.charAt(0)}
                </Link>
                <span className="order-item-name">
                  {item.name}
                  <small>
                    {item.quantity} × {formatNaira(item.price)}
                  </small>
                </span>
                <span className="order-item-price">{formatNaira(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatNaira(order.totalAmount)}</span>
          </div>
        </section>

        <aside className="detail-side">
          <section className="panel" aria-label="Delivery">
            <h2>Delivery</h2>
            <address className="address-block">
              {order.shippingAddress.street}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}
              <br />
              <span>{order.shippingAddress.phone}</span>
            </address>
          </section>

          <section className="panel" aria-label="Payment">
            <h2>Payment</h2>
            <span className={`payment-pill payment-${order.paymentStatus}`}>
              {order.paymentStatus}
            </span>
            <p className="panel-note">
              Payments are processed securely by Paystack. We never see or store your card details.
            </p>
            {!cancelled && order.paymentStatus !== 'paid' && (
              <button type="button" className="btn-secondary btn-block" onClick={handleCancel} disabled={busy}>
                Cancel order
              </button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
