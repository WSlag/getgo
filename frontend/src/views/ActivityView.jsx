import React, { useState } from 'react';
import BidsView from './BidsView';
import ContractsView from './ContractsView';
import BrokerActivityView from './BrokerActivityView';
import ReferredListingsView from './ReferredListingsView';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function ActivityView({
  currentUser,
  currentRole,
  darkMode,
  onOpenChat,
  onOpenContract,
  onBrowseMarketplace,
  onCreateListing,
  onOpenMessages,
  onOpenListing,
  onToast,
  unreadBids = 0,
  pendingContractsCount = 0,
  isBroker = false,
  initialMode = 'my',
}) {
  const [activeSubTab, setActiveSubTab] = useState('bids');
  const [viewMode, setViewMode] = useState(isBroker && initialMode === 'broker' ? 'broker' : 'my');
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const hasReferredListings = Boolean(currentUser?.referredByBrokerId);

  React.useEffect(() => {
    if (isBroker && initialMode === 'broker') {
      setViewMode('broker');
      return;
    }
    setViewMode('my');
  }, [isBroker, initialMode]);

  React.useEffect(() => {
    if (!hasReferredListings && activeSubTab === 'referred') {
      setActiveSubTab('bids');
    }
  }, [hasReferredListings, activeSubTab]);

  return (
    <main
      className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto"
      style={{
        padding: isMobile ? '16px' : '24px',
        paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
        <h1 style={{
          fontWeight: 'bold',
          fontSize: isMobile ? '24px' : '28px',
          color: darkMode ? '#fff' : '#111827',
          marginBottom: '8px'
        }}>
          {viewMode === 'broker' ? 'Broker Activity' : 'My Activity'}
        </h1>
        <p style={{
          fontSize: isMobile ? '13px' : '14px',
          color: darkMode ? '#9ca3af' : '#6b7280'
        }}>
          {viewMode === 'broker'
            ? 'Read-only view of referred users marketplace activity'
            : `Track your ${currentRole === 'trucker' ? 'bids' : 'bookings'} and contracts`}
        </p>
      </div>

      {/* Broker Mode Switcher */}
      {isBroker && (
        <div className="mb-4">
          <div className="flex gap-4">
            <button
              onClick={() => setViewMode('my')}
              className={`flex-1 py-4 px-4 rounded-xl font-bold text-base transition-all ${
                viewMode === 'my'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              My Activity
            </button>
            <button
              onClick={() => setViewMode('broker')}
              className={`flex-1 py-4 px-4 rounded-xl font-bold text-base transition-all ${
                viewMode === 'broker'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Broker Activity
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {viewMode === 'my' && (
        <div className="mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveSubTab('bids')}
              className={`flex-1 py-4 px-4 rounded-xl font-bold text-base transition-all relative ${
                activeSubTab === 'bids'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {currentRole === 'trucker' ? 'My Bids' : 'My Bookings'}
              {unreadBids > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  activeSubTab === 'bids'
                    ? 'bg-white text-orange-500'
                    : 'bg-orange-500 text-white'
                }`}>
                  {unreadBids}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('contracts')}
              className={`flex-1 py-4 px-4 rounded-xl font-bold text-base transition-all relative ${
                activeSubTab === 'contracts'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              Contracts
              {pendingContractsCount > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 text-xs font-bold rounded-full ${
                  activeSubTab === 'contracts'
                    ? 'bg-white text-orange-500'
                    : 'bg-yellow-500 text-white'
                }`}>
                  {pendingContractsCount}
                </span>
              )}
            </button>

            {hasReferredListings && (
              <button
                onClick={() => setActiveSubTab('referred')}
                className={`flex-1 py-4 px-4 rounded-xl font-bold text-base transition-all relative ${
                  activeSubTab === 'referred'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
                }`}
              >
                Referred Listings
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div>
        {viewMode === 'broker' ? (
          <BrokerActivityView onToast={onToast} />
        ) : (
          <>
            {activeSubTab === 'bids' && (
              <BidsView
                currentUser={currentUser}
                currentRole={currentRole}
                onOpenChat={onOpenChat}
                onBrowseMarketplace={onBrowseMarketplace}
                onCreateListing={onCreateListing}
                onOpenMessages={onOpenMessages}
                darkMode={darkMode}
                embedded={true}
              />
            )}

            {activeSubTab === 'contracts' && (
              <ContractsView
                currentUser={currentUser}
                darkMode={darkMode}
                onOpenContract={onOpenContract}
                embedded={true}
              />
            )}

            {activeSubTab === 'referred' && hasReferredListings && (
              <ReferredListingsView
                onOpenListing={onOpenListing}
                onToast={onToast}
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}
