import { useMemo, useState } from 'react';
import { Loader2, Package, Truck, FileText, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBidsOnMyListings } from '@/hooks/useBids';
import { useContracts } from '@/hooks/useContracts';
import { useCargoListings } from '@/hooks/useCargoListings';
import { inferBidPerspectiveRole, inferContractPerspectiveRole } from '@/utils/workspace';
import { getCanonicalTimestamp, sortEntitiesNewestFirst } from '@/utils/activitySorting';

function toDate(value) {
  if (!value) return null;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const dateValue = toDate(value);
  if (!dateValue) return '-';
  return dateValue.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return `PHP ${amount.toLocaleString()}`;
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (normalized === 'accepted') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (normalized === 'completed') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

function normalizeBidStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'accepted' || normalized === 'contracted' || normalized === 'signed') return 'accepted';
  if (normalized === 'completed' || normalized === 'delivered') return 'completed';
  if (['rejected', 'cancelled', 'withdrawn'].includes(normalized)) return 'cancelled';
  return 'pending';
}

function normalizeCargoStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (['contracted', 'in_transit'].includes(normalized)) return 'accepted';
  if (['delivered', 'completed'].includes(normalized)) return 'completed';
  if (['cancelled', 'offline'].includes(normalized)) return 'cancelled';
  return 'pending';
}

function normalizeContractStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'completed';
  if (normalized === 'cancelled' || normalized === 'disputed') return 'cancelled';
  if (normalized === 'signed' || normalized === 'in_transit') return 'accepted';
  return 'pending';
}

function getCounterpartyName(contract, userId) {
  if (!contract) return null;
  const isListingOwner = contract.listingOwnerId === userId;
  return isListingOwner
    ? (contract.bidderName || contract.bidderMasked || 'Counterparty')
    : (contract.listingOwnerName || contract.listingOwnerMasked || 'Counterparty');
}

function getActivityTimestamp(entity, fallbackKeys = []) {
  const canonical = getCanonicalTimestamp(entity, fallbackKeys);
  if (canonical.date) return canonical.date;
  if (canonical.timestamp > 0) return new Date(canonical.timestamp);
  return null;
}

function dedupeByStableKey(items = []) {
  const byKey = new Map();
  items.forEach((item) => {
    if (!item?.stableKey) return;
    const existing = byKey.get(item.stableKey);
    if (!existing) {
      byKey.set(item.stableKey, item);
      return;
    }
    const existingTs = toDate(existing.activityAt)?.getTime() || 0;
    const nextTs = toDate(item.activityAt)?.getTime() || 0;
    if (nextTs >= existingTs) {
      byKey.set(item.stableKey, item);
    }
  });
  return Array.from(byKey.values());
}

function typeLabel(item) {
  if (item.source === 'cargo') return 'Cargo';
  if (item.source === 'bid') return 'Bid';
  return item.typeBuckets.includes('shipment') ? 'Shipment' : 'Contract';
}

function typeIcon(item) {
  if (item.source === 'cargo') return <Package className="size-3.5" />;
  if (item.source === 'bid') return <Truck className="size-3.5" />;
  if (item.typeBuckets.includes('shipment')) return <Truck className="size-3.5" />;
  return <FileText className="size-3.5" />;
}

function matchesTypeFilter(item, activeTypeFilter) {
  if (activeTypeFilter === 'all') return true;
  return item.typeBuckets.includes(activeTypeFilter);
}

function matchesStatusFilter(item, activeStatusFilter) {
  if (activeStatusFilter === 'all') return true;
  return item.status === activeStatusFilter;
}

export function ShipperActivityView({
  currentUser,
  onOpenChat,
  onOpenContract,
  onOpenListing,
  onBrowseMarketplace,
  onCreateListing,
  onOpenMessages,
  typeFilter,
  statusFilter,
  onTypeFilterChange,
  onStatusFilterChange,
}) {
  const userId = currentUser?.uid || currentUser?.id || null;
  const [internalTypeFilter, setInternalTypeFilter] = useState('all');
  const [internalStatusFilter, setInternalStatusFilter] = useState('all');

  const activeTypeFilter = typeFilter || internalTypeFilter;
  const activeStatusFilter = statusFilter || internalStatusFilter;

  const setTypeFilter = onTypeFilterChange || setInternalTypeFilter;
  const setStatusFilter = onStatusFilterChange || setInternalStatusFilter;

  const {
    bids: bidsOnMyListings,
    loading: loadingBids,
    error: bidsError,
  } = useBidsOnMyListings(userId);
  const {
    contracts,
    loading: loadingContracts,
    error: contractsError,
  } = useContracts(userId);
  const {
    listings: cargoListings,
    loading: loadingCargo,
    error: cargoError,
  } = useCargoListings({
    authUser: userId ? (currentUser || { uid: userId }) : null,
    maxResults: 200,
  });

  const loading = loadingBids || loadingContracts || loadingCargo;
  const error = bidsError || contractsError || cargoError || '';

  const typeFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'cargo', label: 'Cargo' },
    { id: 'bids', label: 'Bids' },
    { id: 'shipment', label: 'Shipment' },
    { id: 'contracts', label: 'Contracts' },
  ]), []);

  const statusFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ]), []);

  const shipperIncomingCargoBids = useMemo(
    () => (bidsOnMyListings || []).filter((bid) => (
      inferBidPerspectiveRole(bid, userId) === 'shipper'
      && String(bid.listingType || '').toLowerCase() === 'cargo'
    )),
    [bidsOnMyListings, userId]
  );

  const shipperCargoPosts = useMemo(
    () => (cargoListings || []).filter((cargo) => (
      cargo?.userId === userId || cargo?.shipperId === userId
    )),
    [cargoListings, userId]
  );

  const shipperContracts = useMemo(
    () => (contracts || []).filter((contract) => inferContractPerspectiveRole(contract, userId) === 'shipper'),
    [contracts, userId]
  );

  const normalizedItems = useMemo(() => {
    const cargoItems = shipperCargoPosts.map((cargo) => {
      const activityAt = getActivityTimestamp(cargo, ['postedAt', 'updatedAt', 'createdAt']);
      return {
        id: `cargo:${cargo.id}`,
        stableKey: `cargo:${cargo.id}`,
        source: 'cargo',
        typeBuckets: ['cargo'],
        status: normalizeCargoStatus(cargo.status),
        rawStatus: String(cargo.status || '').toLowerCase(),
        activityAt,
        origin: cargo.origin || null,
        destination: cargo.destination || null,
        amount: Number(cargo.askingPrice || cargo.price || 0),
        counterpartyName: null,
        listingId: cargo.id,
        listingType: 'cargo',
        rawEntity: cargo,
      };
    });

    const bidItems = shipperIncomingCargoBids.map((bid) => {
      const activityAt = getActivityTimestamp(bid, ['createdAt']);
      return {
        id: `bid:${bid.id}`,
        stableKey: `bid:${bid.id}`,
        source: 'bid',
        typeBuckets: ['bids'],
        status: normalizeBidStatus(bid.status),
        rawStatus: String(bid.status || '').toLowerCase(),
        activityAt,
        origin: bid.origin || null,
        destination: bid.destination || null,
        amount: Number(bid.price || 0),
        counterpartyName: bid.bidderName || 'Trucker',
        bidId: bid.id,
        listingId: bid.cargoListingId || bid.listingId || null,
        listingType: bid.listingType || 'cargo',
        listingOwnerId: bid.listingOwnerId || null,
        listingOwnerName: bid.listingOwnerName || null,
        rawEntity: bid,
      };
    });

    const contractItems = shipperContracts.map((contract) => {
      const activityAt = getActivityTimestamp(contract, ['completedAt', 'signedAt', 'createdAt']);
      const rawStatus = String(contract.status || '').toLowerCase();
      const typeBuckets = ['contracts'];
      if (['in_transit', 'completed'].includes(rawStatus)) {
        typeBuckets.push('shipment');
      }
      return {
        id: `contract:${contract.id}`,
        stableKey: `contract:${contract.id}`,
        source: 'contract',
        typeBuckets,
        status: normalizeContractStatus(contract.status),
        rawStatus,
        activityAt,
        origin: contract.pickupCity || contract.pickupAddress || contract.origin || null,
        destination: contract.deliveryCity || contract.deliveryAddress || contract.destination || null,
        amount: Number(contract.agreedPrice || contract.price || 0),
        counterpartyName: getCounterpartyName(contract, userId),
        contractId: contract.id,
        bidId: contract.bidId || null,
        listingId: contract.listingId || null,
        listingType: contract.listingType || null,
        rawEntity: contract,
      };
    });

    const deduped = dedupeByStableKey([...cargoItems, ...bidItems, ...contractItems]);
    return sortEntitiesNewestFirst(deduped, { fallbackKeys: ['activityAt'] });
  }, [shipperCargoPosts, shipperIncomingCargoBids, shipperContracts, userId]);

  const filteredItems = useMemo(
    () => normalizedItems.filter(
      (item) => matchesTypeFilter(item, activeTypeFilter) && matchesStatusFilter(item, activeStatusFilter)
    ),
    [normalizedItems, activeTypeFilter, activeStatusFilter]
  );

  const summary = useMemo(() => {
    const scoped = normalizedItems.filter(
      (item) => matchesTypeFilter(item, activeTypeFilter) && matchesStatusFilter(item, activeStatusFilter)
    );
    return {
      total: scoped.length,
      cargo: scoped.filter((item) => item.typeBuckets.includes('cargo')).length,
      bids: scoped.filter((item) => item.typeBuckets.includes('bids')).length,
      shipment: scoped.filter((item) => item.typeBuckets.includes('shipment')).length,
      contracts: scoped.filter((item) => item.typeBuckets.includes('contracts')).length,
      completed: scoped.filter((item) => item.status === 'completed').length,
    };
  }, [normalizedItems, activeTypeFilter, activeStatusFilter]);

  const filterChipBaseClass = 'inline-flex items-center justify-center rounded-full text-[13px] font-semibold leading-none transition-all duration-200 active:scale-95';
  const activeFilterChipClass = 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-sm shadow-orange-500/30';
  const inactiveFilterChipClass = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600';
  const filterChipStyle = { padding: '8px 14px', minHeight: '34px', lineHeight: 1.1 };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {typeFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTypeFilter(filter.id)}
                style={filterChipStyle}
                className={`${filterChipBaseClass} ${activeTypeFilter === filter.id ? activeFilterChipClass : inactiveFilterChipClass}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                style={filterChipStyle}
                className={`${filterChipBaseClass} ${activeStatusFilter === filter.id ? activeFilterChipClass : inactiveFilterChipClass}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: summary.total, icon: <TrendingUp className="size-3.5 text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-950/30' },
          { label: 'Cargo', value: summary.cargo, icon: <Package className="size-3.5 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Bids', value: summary.bids, icon: <Truck className="size-3.5 text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-950/30' },
          { label: 'Shipment', value: summary.shipment, icon: <Truck className="size-3.5 text-cyan-500" />, bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
          { label: 'Contracts', value: summary.contracts, icon: <FileText className="size-3.5 text-indigo-500" />, bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
          { label: 'Completed', value: summary.completed, icon: <TrendingUp className="size-3.5 text-green-500" />, bg: 'bg-green-50 dark:bg-green-950/30' },
        ].map(({ label, value, icon, bg }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className={`size-6 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                {icon}
              </span>
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
            <Loader2 className="size-5 animate-spin text-orange-500" />
            <p className="text-sm">Loading shipper activity...</p>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 p-4 text-sm">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="size-12 rounded-2xl bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
              <TrendingUp className="size-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No shipper activity for the selected filters.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onBrowseMarketplace}>
                Browse Trucks
              </Button>
              <Button type="button" size="sm" onClick={onCreateListing}>
                Post Cargo
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onOpenMessages}>
                Open Messages
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.contractId) {
                    onOpenContract?.(item.contractId);
                    return;
                  }
                  if (item.bidId) {
                    const listingData = {
                      id: item.listingId,
                      listingType: item.listingType,
                      origin: item.origin,
                      destination: item.destination,
                      userId: item.listingOwnerId,
                      userName: item.listingOwnerName,
                    };
                    onOpenChat?.(item.rawEntity, listingData);
                    return;
                  }
                  if (item.source === 'cargo') {
                    onOpenListing?.(item.rawEntity);
                  }
                }}
                className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 size-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-500">
                      {typeIcon(item)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {typeLabel(item)}
                      </p>
                      {(item.origin || item.destination) && (
                        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          <span className="truncate max-w-[80px]">{item.origin || '-'}</span>
                          <ArrowRight className="size-3 shrink-0" />
                          <span className="truncate max-w-[80px]">{item.destination || '-'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                  {item.counterpartyName && (
                    <span>
                      Counterparty: <span className="text-gray-700 dark:text-gray-300 font-medium">{item.counterpartyName}</span>
                    </span>
                  )}
                  {formatAmount(item.amount) && (
                    <span>
                      Amount: <span className="text-gray-700 dark:text-gray-300 font-medium">{formatAmount(item.amount)}</span>
                    </span>
                  )}
                  {item.activityAt && (
                    <span className="flex items-center gap-1 ml-auto">
                      <Calendar className="size-3" />
                      {formatDate(item.activityAt)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ShipperActivityView;
