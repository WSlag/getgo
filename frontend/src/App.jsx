import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import RegisterScreen from './components/auth/RegisterScreen';
import GetGoApp from './GetGoApp';
import { AlertTriangle, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { NotFoundView } from '@/components/shared/NotFoundView';
import { PWAUpdateNotification } from '@/components/shared/PWAUpdateNotification';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { LiveRegionProvider } from './contexts/LiveRegionContext';
import { getPublicRouteByPath } from '@/config/publicRouteManifest';
import { usePageMeta } from '@/hooks/usePageMeta';

function isValidAppPath(pathname) {
  if (getPublicRouteByPath(pathname)) {
    return true;
  }

  const parts = pathname.split('/').filter(Boolean);
  return parts.length === 2 && parts[0].toLowerCase() === 'r' && Boolean(parts[1]);
}

function FullscreenLoading({ message = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="text-center">
        <Logo className="justify-center mb-6" size="default" />
        <div className="flex items-center justify-center gap-2">
          <Loader2 className="size-5 animate-spin text-orange-500" />
          <span className="text-gray-600 dark:text-gray-400">{message}</span>
        </div>
      </div>
    </div>
  );
}

function ProfileLoadRecovery({ message, onRetry, onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-orange-200 dark:border-orange-900/40 bg-white/95 dark:bg-gray-900/95 shadow-xl p-6">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 inline-flex size-9 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-950/40">
            <AlertTriangle className="size-5 text-orange-600 dark:text-orange-300" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              We could not load your profile
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {message || 'Please retry. If this keeps happening, sign out and sign in again.'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-2">
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-600 transition-colors"
          >
            <RefreshCw className="size-4" />
            Retry Profile Load
          </button>
          <button
            onClick={onSignOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <LogOut className="size-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const {
    loading,
    isNewUser,
    authUser,
    profileLoadStatus,
    profileLoadError,
    retryProfileLoad,
    logout,
  } = useAuth();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const isPathValid = isValidAppPath(pathname);
  usePageMeta(pathname);

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

  // Block authenticated shell until profile state is fully resolved.
  if (authUser && (profileLoadStatus === 'loading' || profileLoadStatus === 'retrying')) {
    const loadingMessage = profileLoadStatus === 'retrying'
      ? 'Retrying profile load...'
      : 'Loading your profile...';
    return <FullscreenLoading message={loadingMessage} />;
  }

  if (authUser && profileLoadStatus === 'failed') {
    return (
      <ProfileLoadRecovery
        message={profileLoadError?.userMessage || profileLoadError?.message}
        onRetry={() => {
          void retryProfileLoad?.();
        }}
        onSignOut={() => {
          void logout?.();
        }}
      />
    );
  }

  // Loading state - show spinner while checking auth/bootstrap
  if (loading) {
    return <FullscreenLoading message="Loading..." />;
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
        <LiveRegionProvider>
          <ToastProvider>
            <AppContent />
            <PWAUpdateNotification />
          </ToastProvider>
        </LiveRegionProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
