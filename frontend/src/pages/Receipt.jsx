import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { formatNaira } from '../utils/format';

const formatDateTime = (value) =>
  new Date(value).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const methodLabel = (method) => (method ? method.replace('_', ' ') : 'Paystack');

export default function Receipt() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
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

  useEffect(() => {
    if (order) document.title = `Receipt ${order._id.slice(-8).toUpperCase()} · Online Store`;
    return () => {
      document.title = 'Online Store';
    };
  }, [order]);

  if (loading) {
    return (
      <div className="page page-loading" role="status">
        <span className="spinner" />
        <span className="visually-hidden">Loading receipt…</span>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1>Receipt not found</h1>
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

  if (order.paymentStatus !== 'paid' || !order.payment) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="eyebrow">Receipt</span>
          <h1>No receipt yet</h1>
          <p>A receipt is available once your payment has been confirmed.</p>
          <Link to={`/orders/${order._id}`}>
            <button type="button" tabIndex={-1}>
              Go to order
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const receiptNumber = order._id.slice(-8).toUpperCase();
  const subtotal = order.orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="page receipt-page">
      <div className="receipt-actions no-print">
        <Link to={`/orders/${order._id}`} className="back-link">
          <span aria-hidden="true">←</span> Back to order
        </Link>
        <button type="button" className="btn-accent" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <article className="receipt" aria-label={`Receipt ${receiptNumber}`}>
        <header className="receipt-head">
          <div>
            <p className="receipt-brand">Online Store</p>
            <p className="receipt-tag">Payment receipt</p>
          </div>
          <div className="receipt-paid-stamp" aria-label="Paid">
            Paid
          </div>
        </header>

        <dl className="receipt-meta">
          <div>
            <dt>Receipt no.</dt>
            <dd>#{receiptNumber}</dd>
          </div>
          <div>
            <dt>Date paid</dt>
            <dd>{formatDateTime(order.payment.paidAt || order.updatedAt)}</dd>
          </div>
          <div>
            <dt>Payment method</dt>
            <dd className="cap">{methodLabel(order.payment.paymentMethod)}</dd>
          </div>
          <div>
            <dt>Reference</dt>
            <dd>
              <code>{order.payment.reference}</code>
            </dd>
          </div>
        </dl>

        <div className="receipt-parties">
          <section>
            <h2>Billed to</h2>
            <p>
              <strong>{order.user?.name}</strong>
              <br />
              {order.user?.email}
            </p>
          </section>
          <section>
            <h2>Delivered to</h2>
            <p>
              {order.shippingAddress.street}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}
              <br />
              {order.shippingAddress.phone}
            </p>
          </section>
        </div>

        <table className="receipt-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num-col">Qty</th>
              <th className="num-col">Unit price</th>
              <th className="num-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.orderItems.map((item) => (
              <tr key={item.product}>
                <td>{item.name}</td>
                <td className="num-col">{item.quantity}</td>
                <td className="num-col">{formatNaira(item.price)}</td>
                <td className="num-col">{formatNaira(item.price * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="receipt-totals">
          <div>
            <span>Subtotal</span>
            <span>{formatNaira(subtotal)}</span>
          </div>
          <div className="receipt-total">
            <span>Total paid</span>
            <span>{formatNaira(order.payment.amount)}</span>
          </div>
        </div>

        <footer className="receipt-foot">
          <p>Thank you for shopping with us.</p>
          <p>
            Payments are processed securely by Paystack. This receipt was generated automatically
            and is valid without a signature.
          </p>
        </footer>
      </article>
    </div>
  );
}
