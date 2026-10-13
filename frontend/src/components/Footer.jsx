import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Footer() {
  const { user } = useAuth();

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-about">
          <p className="footer-brand">Online Store</p>
          <p>Considered essentials, honest pricing, and secure checkout through Paystack.</p>
          <ul className="footer-badges" aria-label="Payment security">
            <li>Secured by Paystack</li>
            <li>Encrypted checkout</li>
          </ul>
        </div>

        <nav className="footer-col" aria-label="Shop">
          <h2>Shop</h2>
          <Link to="/">All products</Link>
          <Link to="/cart">Cart</Link>
          <a href="/#faq">FAQ</a>
        </nav>

        <nav className="footer-col" aria-label="Account">
          <h2>Account</h2>
          {user ? (
            <>
              <Link to="/account">My account</Link>
              <Link to="/orders">Order tracking</Link>
            </>
          ) : (
            <>
              <Link to="/login">Log in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
        </nav>
      </div>
      <p className="footer-legal">© {new Date().getFullYear()} Online Store. All rights reserved.</p>
    </footer>
  );
}
