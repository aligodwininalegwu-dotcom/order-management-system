import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const closeMenu = () => setOpen(false);

  const handleLogout = () => {
    logout();
    closeMenu();
    navigate('/login');
  };

  return (
    <nav className="navbar" aria-label="Main navigation">
      <Link to="/" className="navbar-brand" onClick={closeMenu}>
        Online Store
      </Link>

      <button
        type="button"
        className="navbar-toggle"
        aria-expanded={open}
        aria-controls="navbar-links"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="visually-hidden">{open ? 'Close menu' : 'Open menu'}</span>
        <span aria-hidden="true">{open ? '✕' : '☰'}</span>
      </button>

      <div id="navbar-links" className={`navbar-links${open ? ' is-open' : ''}`} onClick={closeMenu}>
        <NavLink to="/" end>
          Shop
        </NavLink>
        {user && <NavLink to="/orders">Orders</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
        <NavLink to="/cart" className="navbar-cart">
          Cart
          <span className="cart-count" aria-label={`${itemCount} items`}>
            {itemCount}
          </span>
        </NavLink>
        {user ? (
          <>
            <NavLink to="/account" className="navbar-user-link">
              {user.name.split(' ')[0]}
            </NavLink>
            <button type="button" onClick={handleLogout} className="btn-link">
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Log in</NavLink>
            <NavLink to="/register" className="navbar-signup">
              Sign up
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
