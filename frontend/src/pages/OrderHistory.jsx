import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const statusColors = {
  pending: '#a9761a',
  processing: '#2d6ca6',
  shipped: '#6b4fa0',
  delivered: '#1f7a52',
  cancelled: '#b23a3a',
};

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get('/orders/my-orders');
        setOrders(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order? This cannot be undone.')) {
      return;
    }
    setCancellingId(orderId);
    try {
      await api.put(`/orders/${orderId}/cancel`);
      setOrders((prev) =>
        prev.map((order) =>
          order._id === orderId ? { ...order, status: 'cancelled' } : order
        )
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  };

  if (loading) return <div className="page">Loading orders...</div>;
  if (error) return <div className="page error-text">{error}</div>;

  if (orders.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1>No orders yet</h1>
          <p>Your order history will show up here once you make a purchase.</p>
          <Link to="/">
            <button>Browse Products</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>My Orders</h1>

      {orders.map((order) => (
        <div
          key={order._id}
          className="order-card"
          style={{ borderLeftColor: statusColors[order.status] }}
        >
          <div className="order-card-header">
            <div>
              <span className="order-id">Order #{order._id.slice(-8).toUpperCase()}</span>
              <span className="order-date">
                {new Date(order.createdAt).toLocaleDateString('en-NG', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <span
              className="order-status-badge"
              style={{ backgroundColor: statusColors[order.status] }}
            >
              {order.status}
            </span>
          </div>

          <div className="order-items-list">
            {order.orderItems.map((item, idx) => (
              <div key={idx} className="order-item-row">
                <div className="order-item-thumb">{item.name.charAt(0)}</div>
                <span className="order-item-name">
                  {item.name} × {item.quantity}
                </span>
                <span className="order-item-price">
                  ₦{(item.price * item.quantity).toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className="order-card-footer">
            <span className={`payment-pill payment-${order.paymentStatus}`}>
              Payment: {order.paymentStatus}
            </span>
            <div className="order-card-footer-right">
              <span className="order-total">Total: ₦{order.totalAmount.toLocaleString()}</span>
              {order.paymentStatus !== 'paid' && order.status !== 'cancelled' && (
                <button
                  className="btn-secondary btn-cancel-order"
                  disabled={cancellingId === order._id}
                  onClick={() => handleCancel(order._id)}
                >
                  {cancellingId === order._id ? 'Cancelling...' : 'Cancel Order'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}