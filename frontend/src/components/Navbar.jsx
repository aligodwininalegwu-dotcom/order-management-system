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
          Products
        </NavLink>
        <NavLink to="/cart">Cart ({itemCount})</NavLink>
        {user ? (
          <>
            <NavLink to="/orders">My Orders</NavLink>
            {user.role === 'admin' && (
              <>
                <NavLink to="/admin/products">Admin: Products</NavLink>
                <NavLink to="/admin/orders">Admin: Orders</NavLink>
              </>
            )}
            <span className="navbar-user">Hi, {user.name}</span>
            <button type="button" onClick={handleLogout} className="btn-link">
              Logout
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Login</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
