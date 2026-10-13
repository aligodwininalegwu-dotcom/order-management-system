import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { formatDate, formatNaira } from '../../utils/format';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Successful' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
];

const formatDateTime = (value) =>
  `${formatDate(value)}, ${new Date(value).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await api.get('/transactions', { signal: controller.signal });
        setTransactions(res.data);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const totals = useMemo(() => {
    const successful = transactions.filter((t) => t.status === 'success');
    return {
      collected: successful.reduce((sum, t) => sum + t.amount, 0),
      successful: successful.length,
      failed: transactions.filter((t) => t.status === 'failed').length,
      pending: transactions.filter((t) => t.status === 'pending').length,
    };
  }, [transactions]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return transactions.filter(
      (t) =>
        (filter === 'all' || t.status === filter) &&
        (!term ||
          t.reference.toLowerCase().includes(term) ||
          t.user?.name?.toLowerCase().includes(term) ||
          t.user?.email?.toLowerCase().includes(term))
    );
  }, [transactions, filter, search]);

  if (loading) {
    return (
      <div className="page-loading" role="status">
        <span className="spinner" />
        <span className="visually-hidden">Loading transactions…</span>
      </div>
    );
  }

  return (
    <div className="admin-section">
      <div className="stat-grid stat-grid-3">
        <div className="stat-card">
          <span className="stat-label">Collected</span>
          <strong className="stat-value">{formatNaira(totals.collected)}</strong>
          <span className="stat-hint">{totals.successful} successful payments</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pending</span>
          <strong className="stat-value">{totals.pending}</strong>
          <span className="stat-hint">Started but not completed</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Failed</span>
          <strong className="stat-value">{totals.failed}</strong>
          <span className="stat-hint">Declined or abandoned</span>
        </div>
      </div>

      {error && <p className="error-text" role="alert">{error}</p>}

      <div className="toolbar">
        <div className="chip-row toolbar-chips" role="group" aria-label="Filter transactions">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="toolbar-search"
          placeholder="Search reference or customer"
          aria-label="Search transactions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <h2>No transactions found</h2>
          <p>Payments will be listed here as customers check out.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t._id}>
                  <td data-label="Reference">
                    <code className="ref-code">{t.reference}</code>
                  </td>
                  <td data-label="Customer">
                    <span>
                      {t.user?.name || '—'}
                      <br />
                      <small>{t.user?.email}</small>
                    </span>
                  </td>
                  <td data-label="Method">{t.paymentMethod ? t.paymentMethod.replace('_', ' ') : '—'}</td>
                  <td data-label="Amount">
                    <strong>{formatNaira(t.amount)}</strong>
                  </td>
                  <td data-label="Status">
                    <span className={`tx-pill tx-${t.status}`}>{t.status}</span>
                  </td>
                  <td data-label="Date">{formatDateTime(t.paidAt || t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
