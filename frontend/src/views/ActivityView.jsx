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
        <div style={{ marginBottom: '16px' }}>
          <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
            <button
              onClick={() => setViewMode('my')}
              style={{ fontSize: '14px', fontWeight: '600', flex: 1, padding: '10px 16px' }}
              className={`rounded-full transition-all active:scale-95 ${
                viewMode === 'my'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              My Activity
            </button>
            <button
              onClick={() => setViewMode('broker')}
              style={{ fontSize: '14px', fontWeight: '600', flex: 1, padding: '10px 16px' }}
              className={`rounded-full transition-all active:scale-95 ${
                viewMode === 'broker'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Broker Activity
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      {viewMode === 'my' && (
        <div style={{ marginBottom: '24px' }}>
          <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
            <button
              onClick={() => setActiveSubTab('bids')}
              style={{ fontSize: '14px', fontWeight: '600', flex: 1, padding: '10px 16px' }}
              className={`rounded-full transition-all active:scale-95 relative ${
                activeSubTab === 'bids'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
              style={{ fontSize: '14px', fontWeight: '600', flex: 1, padding: '10px 16px' }}
              className={`rounded-full transition-all active:scale-95 relative ${
                activeSubTab === 'contracts'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
                style={{ fontSize: '14px', fontWeight: '600', flex: 1, padding: '10px 16px' }}
                className={`rounded-full transition-all active:scale-95 relative ${
                  activeSubTab === 'referred'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
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
