import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';
import { formatNaira } from '../utils/format';

export default function Checkout() {
  const { items, totalAmount, clearCart } = useCart();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({
    street: '',
    city: '',
    state: '',
    phone: '',
  });

  const handleChange = (e) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const orderRes = await api.post('/orders', {
        orderItems: items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
        })),
        shippingAddress: address,
      });

      const paymentRes = await api.post('/transactions/initialize', {
        orderId: orderRes.data._id,
      });

      clearCart();
      window.location.href = paymentRes.data.authorization_url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="eyebrow">Checkout</span>
          <h1>Your cart is empty</h1>
          <p>Add something to your cart before checking out.</p>
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
        <h1>Checkout</h1>
        <p>Step 2 of 2 · Delivery &amp; payment</p>
      </div>

      <div className="layout-split">
        <form onSubmit={handleSubmit} className="checkout-form">
          <h2>Delivery details</h2>
          <label>
            Street address
            <input
              name="street"
              value={address.street}
              onChange={handleChange}
              autoComplete="street-address"
              required
            />
          </label>
          <label>
            City
            <input
              name="city"
              value={address.city}
              onChange={handleChange}
              autoComplete="address-level2"
              required
            />
          </label>
          <label>
            State
            <input
              name="state"
              value={address.state}
              onChange={handleChange}
              autoComplete="address-level1"
              required
            />
          </label>
          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              value={address.phone}
              onChange={handleChange}
              autoComplete="tel"
              required
            />
          </label>

          {error && <p className="error-text" role="alert">{error}</p>}

          <button type="submit" className="btn-accent btn-lg" disabled={loading}>
            {loading ? 'Preparing secure payment…' : `Pay ${formatNaira(totalAmount)} with Paystack`}
          </button>
          <p className="checkout-note">
            You'll be redirected to Paystack's secure checkout to complete payment.
          </p>
        </form>

        <aside className="summary-card" aria-label="Order summary">
          <h2>Order summary</h2>
          <ul className="summary-item-list">
            {items.map((item) => (
              <li key={item.product}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>{formatNaira(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatNaira(totalAmount)}</span>
          </div>
          <button type="button" className="btn-link" onClick={() => navigate('/cart')}>
            Edit cart
          </button>
        </aside>
      </div>
    </div>
  );
}
