import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatDate, formatNaira } from '../../utils/format';

const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const shortDay = (iso) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

function percentChange(current, previous) {
  if (!previous) return current ? { label: 'New', tone: 'up' } : null;
  const change = ((current - previous) / previous) * 100;
  return {
    label: `${change >= 0 ? '+' : ''}${change.toFixed(0)}%`,
    tone: change >= 0 ? 'up' : 'down',
  };
}

function StatCard({ label, value, hint, delta }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <span className="stat-hint">
        {delta && <span className={`delta delta-${delta.tone}`}>{delta.label}</span>}
        {hint}
      </span>
    </div>
  );
}

function RevenueChart({ series }) {
  const max = Math.max(...series.map((d) => d.revenue), 1);
  const total = series.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div className="panel">
      <div className="panel-head">
        <div>
          <h2>Revenue</h2>
          <p>Last 14 days · {formatNaira(total)}</p>
        </div>
      </div>
      <div className="bar-chart" role="img" aria-label={`Revenue over the last 14 days, total ${formatNaira(total)}`}>
        {series.map((day) => (
          <div key={day.date} className="bar-col" title={`${shortDay(day.date)}: ${formatNaira(day.revenue)}`}>
            <div className="bar-track">
              <div
                className={`bar${day.revenue === 0 ? ' bar-empty' : ''}`}
                style={{ height: `${Math.max((day.revenue / max) * 100, 3)}%` }}
              />
            </div>
            <span className="bar-label">{shortDay(day.date).split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await api.get('/admin/stats', { signal: controller.signal });
        setStats(res.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      }
    })();
    return () => controller.abort();
  }, []);

  if (error) return <p className="error-text" role="alert">{error}</p>;

  if (!stats) {
    return (
      <div className="admin-section" aria-busy="true">
        <div className="stat-grid">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ height: 120 }} />
          ))}
        </div>
        <div className="skeleton" style={{ height: 300, marginTop: 20 }} />
      </div>
    );
  }

  const { revenue, orders, customers, activeProducts, lowStock, recentOrders, dailyRevenue } = stats;
  const delta = percentChange(revenue.last30Days, revenue.previous30Days);
  const statusTotal = Math.max(orders.total, 1);

  return (
    <div className="admin-section">
      <div className="stat-grid">
        <StatCard
          label="Revenue · 30 days"
          value={formatNaira(revenue.last30Days)}
          delta={delta}
          hint=" vs previous 30 days"
        />
        <StatCard
          label="Orders"
          value={orders.total.toLocaleString()}
          hint={`${orders.awaitingPayment} awaiting payment`}
        />
        <StatCard
          label="Average order value"
          value={formatNaira(revenue.averageOrderValue)}
          hint={`${revenue.paidOrdersLast30Days} paid orders`}
        />
        <StatCard
          label="Customers"
          value={customers.toLocaleString()}
          hint={`${activeProducts} active products`}
        />
      </div>

      <div className="dashboard-grid">
        <RevenueChart series={dailyRevenue} />

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Order status</h2>
              <p>{orders.total} orders in total</p>
            </div>
          </div>
          <div className="status-bar" aria-hidden="true">
            {STATUS_ORDER.map((status) => {
              const count = orders.byStatus[status] || 0;
              return count ? (
                <span
                  key={status}
                  className={`status-seg seg-${status}`}
                  style={{ width: `${(count / statusTotal) * 100}%` }}
                />
              ) : null;
            })}
          </div>
          <ul className="status-legend">
            {STATUS_ORDER.map((status) => (
              <li key={status}>
                <span className={`status-dot seg-${status}`} />
                <span className="legend-name">{status}</span>
                <strong>{orders.byStatus[status] || 0}</strong>
              </li>
            ))}
          </ul>
          <p className="panel-lifetime">All-time revenue: {formatNaira(revenue.allTime)}</p>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid-even">
        <div className="panel">
          <div className="panel-head">
            <h2>Recent orders</h2>
            <Link to="/admin/orders">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="panel-empty">No orders yet.</p>
          ) : (
            <ul className="row-list">
              {recentOrders.map((order) => (
                <li key={order._id}>
                  <div>
                    <strong>#{order._id.slice(-8).toUpperCase()}</strong>
                    <span>
                      {order.user?.name || 'Customer'} · {formatDate(order.createdAt)}
                    </span>
                  </div>
                  <div className="row-right">
                    <strong>{formatNaira(order.totalAmount)}</strong>
                    <span className={`order-status-badge status-${order.status}`}>
                      {order.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Low stock</h2>
              <p>At or below {stats.lowStockThreshold} units</p>
            </div>
            <Link to="/admin/products">Manage</Link>
          </div>
          {lowStock.length === 0 ? (
            <p className="panel-empty">Every product is well stocked.</p>
          ) : (
            <ul className="row-list">
              {lowStock.map((product) => (
                <li key={product._id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.category}</span>
                  </div>
                  <span className={`stock-count${product.stockQuantity === 0 ? ' is-out' : ''}`}>
                    {product.stockQuantity === 0 ? 'Sold out' : `${product.stockQuantity} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
