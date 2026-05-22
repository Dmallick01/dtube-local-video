import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  handleClearAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="welcome-screen" style={{ padding: 24 }}>
          <h1>DTube failed to load</h1>
          <p style={{ marginTop: 12, color: 'var(--cdisabled)' }}>
            {this.state.error.message}
          </p>
          <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={this.handleClearAndReload}>
            Clear cache &amp; reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
