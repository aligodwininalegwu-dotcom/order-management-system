import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Like ProtectedRoute, but also requires role === 'admin'. A logged-in
// customer trying to visit an admin page gets sent back to the homepage
// instead of the login page (they're already logged in, just not allowed).
export default function AdminRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
