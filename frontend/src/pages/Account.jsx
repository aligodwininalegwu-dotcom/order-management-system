import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate, formatNaira } from '../utils/format';

const emptyProfile = { name: '', email: '', phone: '', street: '', city: '', state: '' };

export default function Account() {
  const { user, updateUser } = useAuth();
  const { showToast } = useToast();

  const [profile, setProfile] = useState(emptyProfile);
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const [me, tx] = await Promise.all([
          api.get('/auth/me', { signal: controller.signal }),
          api.get('/transactions/my', { signal: controller.signal }),
        ]);
        const data = me.data;
        setProfile({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          street: data.address?.street || '',
          city: data.address?.city || '',
          state: data.address?.state || '',
        });
        setPayments(tx.data);
      } catch (err) {
        if (err.name !== 'AbortError') setProfileError(err.message);
      } finally {
        if (!controller.signal.aborted) setPaymentsLoading(false);
      }
    })();

    return () => controller.abort();
  }, []);

  const handleProfileChange = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    setSavingProfile(true);
    try {
      const res = await api.put('/auth/me', {
        name: profile.name,
        phone: profile.phone,
        address: { street: profile.street, city: profile.city, state: profile.state },
      });
      updateUser({ name: res.data.name });
      showToast('Profile updated');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if (passwords.newPassword !== passwords.confirm) {
      setPasswordError('The new passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await api.put('/auth/me/password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      showToast('Password changed');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">My account</span>
          <h1>Hello, {user.name.split(' ')[0]}</h1>
        </div>
        <Link to="/orders" className="btn-link">
          View my orders
        </Link>
      </div>

      <div className="account-grid">
        <form onSubmit={saveProfile} className="panel form-panel">
          <h2>Profile</h2>
          <div className="form-grid">
            <label>
              Full name
              <input name="name" value={profile.name} onChange={handleProfileChange} required />
            </label>
            <label>
              Email
              <input value={profile.email} disabled />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" value={profile.phone} onChange={handleProfileChange} />
            </label>
          </div>

          <h3>Default delivery address</h3>
          <div className="form-grid">
            <label className="span-2">
              Street address
              <input name="street" value={profile.street} onChange={handleProfileChange} />
            </label>
            <label>
              City
              <input name="city" value={profile.city} onChange={handleProfileChange} />
            </label>
            <label>
              State
              <input name="state" value={profile.state} onChange={handleProfileChange} />
            </label>
          </div>

          {profileError && <p className="error-text" role="alert">{profileError}</p>}
          <div>
            <button type="submit" className="btn-accent" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>

        <form onSubmit={savePassword} className="panel form-panel">
          <h2>Security</h2>
          <label>
            Current password
            <input
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              autoComplete="new-password"
              minLength={6}
              value={passwords.confirm}
              onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
              required
            />
          </label>
          {passwordError && <p className="error-text" role="alert">{passwordError}</p>}
          <div>
            <button type="submit" disabled={savingPassword}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>

      <section className="panel payments-panel" aria-labelledby="payments-title">
        <div className="panel-head">
          <div>
            <h2 id="payments-title">Payment history</h2>
            <p>Every payment attempt on your account</p>
          </div>
        </div>

        {paymentsLoading ? (
          <div className="skeleton" style={{ height: 120 }} aria-hidden="true" />
        ) : payments.length === 0 ? (
          <p className="panel-empty">No payments yet.</p>
        ) : (
          <ul className="row-list">
            {payments.map((payment) => (
              <li key={payment._id}>
                <div>
                  <strong>{formatNaira(payment.amount)}</strong>
                  <span>
                    {formatDate(payment.paidAt || payment.createdAt)}
                    {payment.paymentMethod ? ` · ${payment.paymentMethod.replace('_', ' ')}` : ''}
                    {' · '}
                    <code className="ref-code">{payment.reference}</code>
                  </span>
                </div>
                <div className="row-right">
                  <span className={`tx-pill tx-${payment.status}`}>{payment.status}</span>
                  {payment.order && (
                    <Link to={`/orders/${payment.order._id}`} className="btn-link">
                      View order
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
