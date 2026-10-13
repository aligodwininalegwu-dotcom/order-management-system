import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { formatNaira } from '../utils/format';

export default function Cart() {
  const { items, removeFromCart, updateQuantity, totalAmount, itemCount } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <span className="eyebrow">Your cart</span>
          <h1>Nothing here yet</h1>
          <p>Looks like you haven't added anything. Find something you love.</p>
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
        <h1>Your cart</h1>
        <p>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </p>
      </div>

      <div className="layout-split">
        <div className="cart-items">
          {items.map((item) => (
            <div key={item.product} className="cart-item-row">
              <div className="cart-item-thumb">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" />
                ) : (
                  item.name.charAt(0)
                )}
              </div>
              <div className="cart-item-info">
                <Link to={`/products/${item.product}`} className="cart-item-name">
                  {item.name}
                </Link>
                <span className="cart-item-price">{formatNaira(item.price)} each</span>
              </div>
              <label className="cart-item-qty">
                Qty
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={item.quantity}
                  onChange={(e) => updateQuantity(item.product, Number(e.target.value))}
                />
              </label>
              <div className="cart-item-subtotal">{formatNaira(item.price * item.quantity)}</div>
              <button
                type="button"
                className="btn-link cart-item-remove"
                onClick={() => removeFromCart(item.product)}
                aria-label={`Remove ${item.name} from cart`}
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <aside className="summary-card" aria-label="Order summary">
          <h2>Order summary</h2>
          <div className="summary-row">
            <span>Subtotal</span>
            <span>{formatNaira(totalAmount)}</span>
          </div>
          <div className="summary-row">
            <span>Delivery</span>
            <span>Calculated by seller</span>
          </div>
          <div className="summary-row summary-total">
            <span>Total</span>
            <span>{formatNaira(totalAmount)}</span>
          </div>

          {user ? (
            <button
              type="button"
              className="btn-accent btn-lg summary-cta"
              onClick={() => navigate('/checkout')}
            >
              Proceed to checkout
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-accent btn-lg summary-cta"
                onClick={() => navigate('/login')}
              >
                Log in to checkout
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
