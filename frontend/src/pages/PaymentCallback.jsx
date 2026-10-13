import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

// Paystack redirects the customer back here after checkout, with the
// transaction reference attached as a URL query parameter, e.g.
// http://localhost:3000/payment/callback?reference=T4479...
export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'failed'
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      if (!reference) {
        setStatus('failed');
        setError('No payment reference was found in the URL.');
        return;
      }

      try {
        const res = await api.get(`/transactions/verify/${encodeURIComponent(reference)}`, {
          signal: controller.signal,
        });
        setStatus(res.data.status === 'success' ? 'success' : 'failed');
      } catch (err) {
        if (err.name === 'AbortError') return;
        setStatus('failed');
        setError(err.message);
      }
    })();

    return () => controller.abort();
  }, [reference]);

  if (status === 'verifying') {
    return (
      <div className="page page-loading" role="status">
        <div className="status-card">
          <span className="spinner" style={{ margin: '0 auto 20px' }} />
          <h1>Verifying payment</h1>
          <p>Please wait while we confirm your payment with Paystack.</p>
        </div>
      </div>
    );
  }

  const succeeded = status === 'success';

  return (
    <div className="page">
      <div className="status-card">
        <div className={`status-icon ${succeeded ? 'is-success' : 'is-failed'}`} aria-hidden="true">
          {succeeded ? '✓' : '!'}
        </div>
        <h1>{succeeded ? 'Payment successful' : 'Payment not confirmed'}</h1>
        <p>
          {succeeded
            ? 'Thank you! Your order has been paid for and is now being processed.'
            : error ||
              'We could not confirm this payment. If money was deducted, please contact support with your reference.'}
        </p>
        {reference && <p className="status-ref">Reference: {reference}</p>}
        <div>
          <Link to="/orders">
            <button type="button" className={succeeded ? 'btn-accent' : ''} tabIndex={-1}>
              View your orders
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
