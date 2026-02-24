import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import RegisterScreen from './components/auth/RegisterScreen';
import GetGoApp from './GetGoApp';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { NotFoundView } from '@/components/shared/NotFoundView';
import { PWAUpdateNotification } from '@/components/shared/PWAUpdateNotification';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';

function isValidAppPath(pathname) {
  if (pathname === '/') {
    return true;
  }

  const parts = pathname.split('/').filter(Boolean);
  return parts.length === 2 && parts[0].toLowerCase() === 'r' && Boolean(parts[1]);
}

function AppContent() {
  const { loading, isNewUser, authUser } = useAuth();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isPathValid = isValidAppPath(pathname);

  // Capture broker referral code from deep links for registration attribution.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    let code = '';

    const pathParts = url.pathname.split('/').filter(Boolean);
    if (pathParts.length === 2 && pathParts[0].toLowerCase() === 'r') {
      code = pathParts[1] || '';
    }

    if (!code) {
      code = url.searchParams.get('ref') || '';
    }

    const normalized = String(code || '').trim().toUpperCase();
    if (!normalized) return;

    window.localStorage.setItem('karga_referral_code', normalized);

    // Normalize URL after capture.
    if (url.pathname !== '/' || url.searchParams.has('ref')) {
      window.history.replaceState({}, '', '/');
    }
  }, []);

  if (!isPathValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-6">
        <NotFoundView onGoHome={() => window.location.assign('/')} />
      </div>
    );
  }

  // Loading state - show spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <Logo className="justify-center mb-6" size="default" />
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-orange-500" />
            <span className="text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated but no profile yet - show registration
  // This happens after successful OTP verification for new users
  if (authUser && isNewUser) {
    return <RegisterScreen />;
  }

  // Show main app for both authenticated users AND guests
  // Login/signup is handled via modal when user tries protected actions
  return <GetGoApp />;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
          <PWAUpdateNotification />
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
