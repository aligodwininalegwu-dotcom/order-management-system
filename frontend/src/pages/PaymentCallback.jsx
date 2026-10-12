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
    const verify = async () => {
      if (!reference) {
        setStatus('failed');
        setError('No payment reference found in the URL.');
        return;
      }

      try {
        const res = await api.get(`/transactions/verify/${encodeURIComponent(reference)}`);
        setStatus(res.data.status === 'success' ? 'success' : 'failed');
      } catch (err) {
        setStatus('failed');
        setError(err.message);
      }
    };

    verify();
  }, [reference]);

  return (
    <div className="page">
      {status === 'verifying' && <p>Verifying your payment...</p>}

      {status === 'success' && (
        <>
          <h1>Payment Successful</h1>
          <p>Your order has been paid for and is now being processed.</p>
          <Link to="/orders">View your orders</Link>
        </>
      )}

      {status === 'failed' && (
        <>
          <h1>Payment Not Confirmed</h1>
          <p>
            {error ||
              'We could not confirm this payment. If money was deducted, please contact support with your reference.'}
          </p>
          <p>Reference: {reference}</p>
          <Link to="/orders">View your orders</Link>
        </>
      )}
    </div>
  );
}
