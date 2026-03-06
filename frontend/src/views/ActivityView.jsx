import React from 'react';
import BrokerActivityView from './BrokerActivityView';
import TruckerActivityView from './TruckerActivityView';
import ShipperActivityView from './ShipperActivityView';
import ReferredListingsView from './ReferredListingsView';
import { getWorkspaceLabel } from '@/utils/workspace';
import { activityPillClass, activityPillRowClass } from './activityPills';

export default function ActivityView({
  currentUser,
  currentRole: _currentRole,
  workspaceRole = 'shipper',
  workspaceOptions: _workspaceOptions = ['shipper'],
  onWorkspaceChange: _onWorkspaceChange,
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
  const isBrokerWorkspace = workspaceRole === 'broker' && isBroker;
  const isTruckerWorkspace = workspaceRole === 'trucker';
  const workspaceLabel = getWorkspaceLabel(workspaceRole);
  const [activityMode, setActivityMode] = React.useState('activity');
  const brokerFilters = workspaceFilters.broker || { typeFilter: 'all', statusFilter: 'all' };
  const truckerFilters = workspaceFilters.trucker || { typeFilter: 'all', statusFilter: 'all' };
  const shipperFilters = workspaceFilters.shipper || { typeFilter: 'all', statusFilter: 'all' };
  const showReferredListings = !isBrokerWorkspace;
  const activityModeOptions = [
    { id: 'activity', label: 'My Activity' },
    { id: 'referrals', label: 'Referred Listings' },
  ];

  React.useEffect(() => {
    if (isBrokerWorkspace && activityMode !== 'activity') {
      setActivityMode('activity');
    }
  }, [isBrokerWorkspace, activityMode]);

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
    <main className="flex-1 overflow-y-auto bg-background px-4 lg:px-6 pb-[calc(104px+env(safe-area-inset-bottom,0px))] lg:pb-6">
      <div className="mb-6 pt-4 lg:mb-8 lg:pt-6">
        <h1 className="mb-2 text-[1.75rem] font-medium leading-tight tracking-tight text-foreground lg:text-3xl">
          {isBrokerWorkspace ? 'Broker Activity' : `${workspaceLabel} Activity`}
        </h1>
        <p className="text-sm font-normal text-muted-foreground">
          {activityMode === 'referrals' && showReferredListings
            ? 'Listings directly referred to you by brokers'
            : isBrokerWorkspace
            ? 'Read-only view of referred users marketplace activity'
            : isTruckerWorkspace
              ? 'Track your bids, bookings, contracts, and delivery activity'
              : 'Track your cargo, bids, contracts, and shipment activity'}
        </p>
      </div>

      <div>
        {showReferredListings && (
          <div className="mb-5 rounded-2xl border border-border bg-card p-2 shadow-sm lg:mb-6">
            <div className={activityPillRowClass}>
              {activityModeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActivityMode(option.id)}
                  className={activityPillClass(activityMode === option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {activityMode === 'referrals' && showReferredListings ? (
          <ReferredListingsView
            onOpenListing={onOpenListing}
            onToast={onToast}
          />
        ) : isBrokerWorkspace ? (
          <BrokerActivityView
            onToast={onToast}
            onOpenListing={onOpenListing}
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
