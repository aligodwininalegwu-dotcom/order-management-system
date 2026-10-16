import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { payForOrder } from '../api/payments';
import { formatDate, formatNaira } from '../utils/format';

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await api.get('/orders/my-orders', { signal: controller.signal });
        setOrders(res.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) {
      return;
    }
    setBusyId(orderId);
    setError('');
    try {
      await api.put(`/orders/${orderId}/cancel`);
      setOrders((prev) =>
        prev.map((order) => (order._id === orderId ? { ...order, status: 'cancelled' } : order))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const handlePay = async (orderId) => {
    setBusyId(orderId);
    setError('');
    try {
      await payForOrder(orderId);
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="page page-loading" role="status">
        <span className="spinner" />
        <span className="visually-hidden">Loading orders…</span>
      </div>
    );
  }

  if (!error && orders.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="eyebrow">Orders</span>
          <h1>No orders yet</h1>
          <p>Your order history will show up here once you make a purchase.</p>
          <Link to="/">
            <button type="button" tabIndex={-1}>
              Browse products
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-heading">
        <h1>My orders</h1>
        <p>
          {orders.length} {orders.length === 1 ? 'order' : 'orders'}
        </p>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {orders.map((order) => {
        const unpaid = order.paymentStatus !== 'paid' && order.status !== 'cancelled';
        return (
          <article key={order._id} className={`order-card status-${order.status}`}>
            <div className="order-card-header">
              <div>
                <Link to={`/orders/${order._id}`} className="order-id order-link">
                  Order #{order._id.slice(-8).toUpperCase()}
                </Link>
                <span className="order-date">{formatDate(order.createdAt)}</span>
              </div>
              <span className="order-status-badge">{order.status}</span>
            </div>

            <div className="order-items-list">
              {order.orderItems.map((item) => (
                <div key={item.product} className="order-item-row">
                  <div className="order-item-thumb" aria-hidden="true">
                    {item.name.charAt(0)}
                  </div>
                  <span className="order-item-name">
                    {item.name} × {item.quantity}
                  </span>
                  <span className="order-item-price">{formatNaira(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="order-card-footer">
              <span className={`payment-pill payment-${order.paymentStatus}`}>
                Payment {order.paymentStatus}
              </span>
              <div className="order-card-footer-right">
                <span className="order-total">{formatNaira(order.totalAmount)}</span>
                <Link to={`/orders/${order._id}`} className="btn-link">
                  Track order
                </Link>
                {order.paymentStatus === 'paid' && (
                  <Link to={`/orders/${order._id}/receipt`} className="btn-link">
                    Receipt
                  </Link>
                )}
                {unpaid && (
                  <>
                    <button
                      type="button"
                      className="btn-secondary btn-cancel-order"
                      disabled={busyId === order._id}
                      onClick={() => handleCancel(order._id)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn-accent btn-cancel-order"
                      disabled={busyId === order._id}
                      onClick={() => handlePay(order._id)}
                    >
                      {busyId === order._id ? 'Please wait…' : 'Pay now'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
