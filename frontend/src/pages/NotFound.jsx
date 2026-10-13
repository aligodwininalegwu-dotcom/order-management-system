import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <span className="eyebrow">Error 404</span>
        <h1>Page not found</h1>
        <p>The page you're looking for doesn't exist or may have moved.</p>
        <Link to="/">
          <button type="button" tabIndex={-1}>
            Back to the store
          </button>
        </Link>
      </div>
    </div>
  );
}
