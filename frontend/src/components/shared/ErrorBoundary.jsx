import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    try {
      import('@sentry/react').then(Sentry => {
        if (Sentry.isInitialized()) {
          Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } });
        }
      });
    } catch (_) { /* Sentry not available */ }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-4">
              <AlertTriangle className="w-7 h-7 text-orange-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
