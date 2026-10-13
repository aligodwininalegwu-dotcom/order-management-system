import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <p className="footer-brand">Online Store</p>
          <p>Considered essentials, honest pricing, and secure checkout through Paystack.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/">Shop</Link>
          <Link to="/cart">Cart</Link>
          <Link to="/orders">My orders</Link>
          <Link to="/login">Account</Link>
        </nav>
      </div>
      <p className="footer-legal">© {new Date().getFullYear()} Online Store. All rights reserved.</p>
    </footer>
  );
}
