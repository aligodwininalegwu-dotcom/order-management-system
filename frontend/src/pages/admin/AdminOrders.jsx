import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { formatNaira } from '../../utils/format';

const STATUS_OPTIONS = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/orders');
        setOrders(res.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    setUpdatingId(orderId);
    setError('');
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((order) => (order._id === orderId ? { ...order, status: newStatus } : order))
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
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

  return (
    <div className="page">
      <div className="page-heading">
        <h1>Manage orders</h1>
        <p>{orders.length} total</p>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      {orders.length === 0 ? (
        <div className="empty-state">
          <h2>No orders yet</h2>
          <p>Orders will appear here as customers check out.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order._id}>
                  <td data-label="Order">
                    <strong>#{order._id.slice(-8).toUpperCase()}</strong>
                  </td>
                  <td data-label="Customer">
                    <span>
                      {order.user?.name}
                      <br />
                      <small>{order.user?.email}</small>
                    </span>
                  </td>
                  <td data-label="Items">
                    <span>
                      {order.orderItems.map((item) => (
                        <div key={item.product}>
                          {item.name} × {item.quantity}
                        </div>
                      ))}
                    </span>
                  </td>
                  <td data-label="Total">{formatNaira(order.totalAmount)}</td>
                  <td data-label="Payment">
                    <span className={`payment-pill payment-${order.paymentStatus}`}>
                      {order.paymentStatus}
                    </span>
                  </td>
                  <td data-label="Status">
                    <select
                      aria-label={`Status for order ${order._id.slice(-8)}`}
                      value={order.status}
                      disabled={updatingId === order._id}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
