import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useCart } from '../context/CartContext';

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
      const orderPayload = {
        orderItems: items.map((item) => ({
          product: item.product,
          quantity: item.quantity,
        })),
        shippingAddress: address,
      };

      const orderRes = await api.post('/orders', orderPayload);
      const order = orderRes.data;

      const paymentRes = await api.post('/transactions/initialize', {
        orderId: order._id,
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
        <p>Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Checkout</h1>

      <div className="layout-split">
        <form onSubmit={handleSubmit} className="checkout-form">
          <h2>Shipping Details</h2>
          <label>
            Street Address
            <input name="street" value={address.street} onChange={handleChange} required />
          </label>
          <label>
            City
            <input name="city" value={address.city} onChange={handleChange} required />
          </label>
          <label>
            State
            <input name="state" value={address.state} onChange={handleChange} required />
          </label>
          <label>
            Phone Number
            <input name="phone" value={address.phone} onChange={handleChange} required />
          </label>

          {error && <p className="error-text">{error}</p>}

          <button type="submit" className="btn-accent" disabled={loading}>
            {loading ? 'Processing...' : `Pay ₦${totalAmount.toLocaleString()} with Paystack`}
          </button>
          <p className="checkout-note">
            You'll be redirected to Paystack's secure checkout to complete payment.
          </p>
        </form>

        <aside className="summary-card">
          <h2>Order Summary</h2>
          <ul className="summary-item-list">
            {items.map((item) => (
              <li key={item.product}>
                <span>
                  {item.name} × {item.quantity}
                </span>
                <span>₦{(item.price * item.quantity).toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>₦{totalAmount.toLocaleString()}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}