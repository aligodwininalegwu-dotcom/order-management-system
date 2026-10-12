import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

export default function Cart() {
  const { items, removeFromCart, updateQuantity, totalAmount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <h1>Your cart is empty</h1>
          <p>Looks like you haven't added anything yet.</p>
          <Link to="/">
            <button>Browse Products</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Your Cart</h1>

      <div className="layout-split">
        <div className="cart-items">
          {items.map((item) => (
            <div key={item.product} className="cart-item-row">
              <div className="cart-item-thumb">{item.name.charAt(0)}</div>
              <div className="cart-item-info">
                <span className="cart-item-name">{item.name}</span>
                <span className="cart-item-price">₦{item.price.toLocaleString()} each</span>
              </div>
              <div className="cart-item-qty">
                <label>Qty</label>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.product, Number(e.target.value))}
                />
              </div>
              <div className="cart-item-subtotal">
                ₦{(item.price * item.quantity).toLocaleString()}
              </div>
              <button className="btn-link cart-item-remove" onClick={() => removeFromCart(item.product)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <aside className="summary-card">
          <h2>Order Summary</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>₦{totalAmount.toLocaleString()}</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>₦{totalAmount.toLocaleString()}</span>
          </div>

          {user ? (
            <button className="btn-accent summary-cta" onClick={() => navigate('/checkout')}>
              Proceed to Checkout
            </button>
          ) : (
            <>
              <button className="btn-accent summary-cta" onClick={() => navigate('/login')}>
                Login to Checkout
              </button>
              <p className="summary-note">
                New here? <Link to="/register">Create an account</Link>
              </p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}