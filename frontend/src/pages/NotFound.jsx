import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <h1>404 — Page Not Found</h1>
        <p>The page you're looking for doesn't exist or may have moved.</p>
        <Link to="/">
          <button>Back to Home</button>
        </Link>
      </div>
    </div>
  );
}