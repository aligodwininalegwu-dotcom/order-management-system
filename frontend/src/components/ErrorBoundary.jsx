import { Component } from 'react';

// Catches render-time crashes anywhere below it so the user sees a recovery
// screen instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="page">
        <div className="empty-state" role="alert">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Reloading the page usually fixes it.</p>
          <button onClick={() => window.location.assign('/')}>Back to the store</button>
        </div>
      </div>
    );
  }
}
