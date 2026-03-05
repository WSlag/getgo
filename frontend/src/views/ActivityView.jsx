import React, { useState } from 'react';
import BidsView from './BidsView';
import ContractsView from './ContractsView';
import BrokerActivityView from './BrokerActivityView';
import ReferredListingsView from './ReferredListingsView';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { WorkspaceSwitcher } from '@/components/shared/WorkspaceSwitcher';
import { getWorkspaceLabel } from '@/utils/workspace';

export default function ActivityView({
  currentUser,
  currentRole,
  workspaceRole = 'shipper',
  workspaceOptions = ['shipper'],
  onWorkspaceChange,
  darkMode,
  onOpenChat,
  onOpenContract,
  onBrowseMarketplace,
  onCreateListing,
  onOpenMessages,
  onOpenListing,
  onToast,
  bidsCount = 0,
  contractsCount = 0,
  isBroker = false,
}) {
  const [activeSubTab, setActiveSubTab] = useState('bids');
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const hasReferredListings = Boolean(currentUser?.referredByBrokerId);
  const isBrokerWorkspace = workspaceRole === 'broker' && isBroker;
  const workspaceLabel = getWorkspaceLabel(workspaceRole);

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
      <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
        <h1 style={{
          fontWeight: 'bold',
          fontSize: isMobile ? '24px' : '28px',
          color: darkMode ? '#fff' : '#111827',
          marginBottom: '8px'
        }}>
          {isBrokerWorkspace ? 'Broker Activity' : `${workspaceLabel} Activity`}
        </h1>
        <p style={{
          fontSize: isMobile ? '13px' : '14px',
          color: darkMode ? '#9ca3af' : '#6b7280'
        }}>
          {isBrokerWorkspace
            ? 'Read-only view of referred users marketplace activity'
            : `Track your ${workspaceRole === 'trucker' ? 'bids' : 'bookings'} and contracts`}
        </p>
        <div style={{ marginTop: '12px' }}>
          <WorkspaceSwitcher
            value={workspaceRole}
            options={workspaceOptions}
            onChange={onWorkspaceChange}
            compact={isMobile}
            showLabel={false}
          />
        </div>
      </div>

      {!isBrokerWorkspace && (
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
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                <span>{workspaceRole === 'trucker' ? 'My Bids' : 'My Bookings'}</span>
                {bidsCount > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold rounded-full ${
                      activeSubTab === 'bids'
                        ? 'bg-white text-orange-500'
                        : 'bg-orange-500 text-white'
                    }`}
                  >
                    {bidsCount}
                  </span>
                )}
              </span>
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
                <span className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                <span>Contracts</span>
                {contractsCount > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-bold rounded-full ${
                      activeSubTab === 'contracts'
                        ? 'bg-white text-orange-500'
                        : 'bg-yellow-500 text-white'
                    }`}
                  >
                    {contractsCount}
                  </span>
                )}
              </span>
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

      <div>
        {isBrokerWorkspace ? (
          <BrokerActivityView onToast={onToast} />
        ) : (
          <>
            {activeSubTab === 'bids' && (
              <BidsView
                currentUser={currentUser}
                currentRole={workspaceRole || currentRole}
                onOpenChat={onOpenChat}
                onBrowseMarketplace={onBrowseMarketplace}
                onCreateListing={onCreateListing}
                onOpenMessages={onOpenMessages}
                darkMode={darkMode}
                embedded={true}
                workspaceRole={workspaceRole}
              />
            )}

            {activeSubTab === 'contracts' && (
              <ContractsView
                currentUser={currentUser}
                darkMode={darkMode}
                onOpenContract={onOpenContract}
                embedded={true}
                workspaceRole={workspaceRole}
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
