import React from 'react';
import BrokerActivityView from './BrokerActivityView';
import TruckerActivityView from './TruckerActivityView';
import ShipperActivityView from './ShipperActivityView';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { getWorkspaceLabel } from '@/utils/workspace';

export default function ActivityView({
  currentUser,
  currentRole: _currentRole,
  workspaceRole = 'shipper',
  workspaceOptions: _workspaceOptions = ['shipper'],
  onWorkspaceChange: _onWorkspaceChange,
  darkMode,
  onOpenChat,
  onOpenContract,
  onBrowseMarketplace,
  onCreateListing,
  onOpenMessages,
  onOpenListing,
  onToast,
  bidsCount: _bidsCount = 0,
  contractsCount: _contractsCount = 0,
  isBroker = false,
}) {
  const [workspaceFilters, setWorkspaceFilters] = React.useState({
    broker: { typeFilter: 'all', statusFilter: 'all' },
    trucker: { typeFilter: 'all', statusFilter: 'all' },
    shipper: { typeFilter: 'all', statusFilter: 'all' },
  });
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const isBrokerWorkspace = workspaceRole === 'broker' && isBroker;
  const isTruckerWorkspace = workspaceRole === 'trucker';
  const workspaceLabel = getWorkspaceLabel(workspaceRole);
  const brokerFilters = workspaceFilters.broker || { typeFilter: 'all', statusFilter: 'all' };
  const truckerFilters = workspaceFilters.trucker || { typeFilter: 'all', statusFilter: 'all' };
  const shipperFilters = workspaceFilters.shipper || { typeFilter: 'all', statusFilter: 'all' };

  const setWorkspaceFilter = React.useCallback((workspace, key, value) => {
    setWorkspaceFilters((prev) => ({
      ...prev,
      [workspace]: {
        ...(prev[workspace] || { typeFilter: 'all', statusFilter: 'all' }),
        [key]: value,
      },
    }));
  }, []);

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
            : isTruckerWorkspace
              ? 'Track your bids, bookings, contracts, and delivery activity'
              : 'Track your cargo, bids, contracts, and shipment activity'}
        </p>
      </div>

      <div>
        {isBrokerWorkspace ? (
          <BrokerActivityView
            onToast={onToast}
            typeFilter={brokerFilters.typeFilter}
            statusFilter={brokerFilters.statusFilter}
            onTypeFilterChange={(value) => setWorkspaceFilter('broker', 'typeFilter', value)}
            onStatusFilterChange={(value) => setWorkspaceFilter('broker', 'statusFilter', value)}
          />
        ) : isTruckerWorkspace ? (
          <TruckerActivityView
            currentUser={currentUser}
            onOpenChat={onOpenChat}
            onOpenContract={onOpenContract}
            onBrowseMarketplace={onBrowseMarketplace}
            onCreateListing={onCreateListing}
            onOpenMessages={onOpenMessages}
            typeFilter={truckerFilters.typeFilter}
            statusFilter={truckerFilters.statusFilter}
            onTypeFilterChange={(value) => setWorkspaceFilter('trucker', 'typeFilter', value)}
            onStatusFilterChange={(value) => setWorkspaceFilter('trucker', 'statusFilter', value)}
          />
        ) : (
          <ShipperActivityView
            currentUser={currentUser}
            onOpenChat={onOpenChat}
            onOpenContract={onOpenContract}
            onOpenListing={onOpenListing}
            onBrowseMarketplace={onBrowseMarketplace}
            onCreateListing={onCreateListing}
            onOpenMessages={onOpenMessages}
            typeFilter={shipperFilters.typeFilter}
            statusFilter={shipperFilters.statusFilter}
            onTypeFilterChange={(value) => setWorkspaceFilter('shipper', 'typeFilter', value)}
            onStatusFilterChange={(value) => setWorkspaceFilter('shipper', 'statusFilter', value)}
          />
        )}
      </div>
    </main>
  );
}
