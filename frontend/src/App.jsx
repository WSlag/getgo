import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginScreen from './components/auth/LoginScreen';
import RegisterScreen from './components/auth/RegisterScreen';
import GetGoApp from './GetGoApp';
import KargaMarketplace from './KargaMarketplace';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { PWAUpdateNotification } from '@/components/shared/PWAUpdateNotification';

// Feature flag to switch between old and new UI
const USE_NEW_UI = true;

function AppContent() {
  const { loading, isAuthenticated, isNewUser, authUser } = useAuth();
  const [darkMode, setDarkMode] = useState(false);
  const [demoMode, setDemoMode] = useState(false);

  // Demo mode - skip auth and show marketplace with sample data
  if (demoMode) {
    return USE_NEW_UI ? <GetGoApp /> : <KargaMarketplace />;
  }

  // Loading state - new design
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="text-center">
          <Logo className="justify-center mb-6" size="lg" />
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin text-orange-500" />
            <span className="text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!authUser) {
    return <LoginScreen darkMode={darkMode} onSkipLogin={() => setDemoMode(true)} />;
  }

  // Authenticated but no profile yet - show registration
  if (isNewUser) {
    return <RegisterScreen darkMode={darkMode} />;
  }

  // Fully authenticated with profile - show marketplace
  return USE_NEW_UI ? <GetGoApp /> : <KargaMarketplace />;
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
      <PWAUpdateNotification />
    </AuthProvider>
  );
}

export default App;
