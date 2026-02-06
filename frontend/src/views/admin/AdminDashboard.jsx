import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';

// Admin Views
import { DashboardOverview } from './DashboardOverview';
import { UserManagement } from './UserManagement';
import { ListingsManagement } from './ListingsManagement';
import { ContractsView } from './ContractsView';
import { ShipmentsView } from './ShipmentsView';
import { PaymentsView } from './PaymentsView';
import { FinancialOverview } from './FinancialOverview';
import { DisputesManagement } from './DisputesManagement';
import { ReferralManagement } from './ReferralManagement';
import { RatingsManagement } from './RatingsManagement';
import { SystemSettings } from './SystemSettings';

import api from '@/services/api';

const sectionTitles = {
  overview: { title: 'Dashboard', subtitle: 'Platform overview and key metrics' },
  users: { title: 'User Management', subtitle: 'Manage all platform users' },
  listings: { title: 'Listings Management', subtitle: 'Monitor and moderate cargo/truck listings' },
  contracts: { title: 'Contracts', subtitle: 'View and manage all contracts' },
  shipments: { title: 'Shipments', subtitle: 'Track active shipments' },
  payments: { title: 'Payment Review', subtitle: 'Review and verify GCash payment submissions' },
  financial: { title: 'Financial Overview', subtitle: 'Platform revenue and transactions' },
  disputes: { title: 'Disputes', subtitle: 'Handle and resolve disputes' },
  referrals: { title: 'Referral Program', subtitle: 'Manage brokers and referrals' },
  ratings: { title: 'Ratings & Reviews', subtitle: 'Monitor platform quality' },
  settings: { title: 'System Settings', subtitle: 'Configure platform parameters' },
};

export function AdminDashboard({ onBackToApp }) {
  const { userProfile, isAdmin } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [activeSection, setActiveSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [badges, setBadges] = useState({
    pendingPayments: 0,
    openDisputes: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Fetch badge counts
  const fetchBadges = useCallback(async () => {
    try {
      const stats = await api.admin.getPaymentStats();
      setBadges({
        pendingPayments: stats?.stats?.pendingReview || 0,
        openDisputes: 0, // TODO: Add dispute count endpoint
      });
    } catch (err) {
      console.error('Error fetching admin badges:', err);
    }
  }, []);

  useEffect(() => {
    fetchBadges();
    // Refresh every 30 seconds
    const interval = setInterval(fetchBadges, 30000);
    return () => clearInterval(interval);
  }, [fetchBadges]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBadges();
    setTimeout(() => setRefreshing(false), 500);
  };

  // Redirect if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            You don't have permission to access the admin dashboard.
          </p>
          <button
            onClick={onBackToApp}
            className="px-6 py-3 bg-gradient-to-r from-orange-400 to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Go Back to App
          </button>
        </div>
      </div>
    );
  }

  const currentSection = sectionTitles[activeSection] || sectionTitles.overview;

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return <DashboardOverview badges={badges} onNavigate={setActiveSection} />;
      case 'users':
        return <UserManagement />;
      case 'listings':
        return <ListingsManagement />;
      case 'contracts':
        return <ContractsView />;
      case 'shipments':
        return <ShipmentsView />;
      case 'payments':
        return <PaymentsView />;
      case 'financial':
        return <FinancialOverview />;
      case 'disputes':
        return <DisputesManagement />;
      case 'referrals':
        return <ReferralManagement />;
      case 'ratings':
        return <RatingsManagement />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <DashboardOverview badges={badges} onNavigate={setActiveSection} />;
    }
  };

  return (
    <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-950', darkMode && 'dark')}>
      {/* Sidebar */}
      <AdminSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onBackToApp={onBackToApp}
        badges={badges}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content - offset by sidebar width on desktop */}
      <div
        className="min-h-screen flex flex-col"
        style={{ marginLeft: isDesktop ? '288px' : '0' }}
      >
        {/* Header */}
        <AdminHeader
          title={currentSection.title}
          subtitle={currentSection.subtitle}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          onMenuClick={() => setSidebarOpen(true)}
          userProfile={userProfile}
        />

        {/* Content Area */}
        <main className="flex-1 p-3 lg:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
