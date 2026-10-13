import { NavLink, Outlet } from 'react-router-dom';

const SECTIONS = [
  { to: '/admin/dashboard', label: 'Overview' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/transactions', label: 'Transactions' },
  { to: '/admin/products', label: 'Products' },
];

// Shared frame for every admin page: a heading plus section tabs.
export default function AdminLayout() {
  return (
    <div className="page admin-page">
      <div className="admin-bar">
        <div>
          <span className="eyebrow">Admin console</span>
          <p className="admin-bar-title">Store management</p>
        </div>
        <nav className="admin-tabs" aria-label="Admin sections">
          {SECTIONS.map((section) => (
            <NavLink key={section.to} to={section.to}>
              {section.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
