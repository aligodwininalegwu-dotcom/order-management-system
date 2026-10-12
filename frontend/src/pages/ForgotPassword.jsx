import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email }, { auth: false });
      setSubmitted(true);
      // No email service is configured for this project, so the backend
      // returns the reset link directly instead of sending it by email.
      if (res.data?.resetUrl) {
        setResetUrl(res.data.resetUrl);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <span className="auth-panel-brand">Online Store</span>
        <h1>Forgot your password?</h1>
        <p>Enter your email and we'll help you get back into your account.</p>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <h2>Reset Password</h2>

          {!submitted ? (
            <form onSubmit={handleSubmit} className="auth-form-inner">
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              {error && <p className="error-text">{error}</p>}
              <button type="submit" className="btn-accent" disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          ) : (
            <div className="reset-link-box">
              <p>
                If an account exists for <strong>{email}</strong>, a reset link has been
                generated.
              </p>
              {resetUrl && (
                <>
                  <p className="reset-link-note">
                    Development mode: email delivery isn't configured, so the reset link is shown here:
                  </p>
                  <Link to={resetUrl.replace(window.location.origin, '')} className="reset-link">
                    {resetUrl}
                  </Link>
                </>
              )}
            </div>
          )}

          <p className="auth-switch">
            <Link to="/login">Back to Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}