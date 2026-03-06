import { useMemo, useState } from 'react';
import { Loader2, Package, Truck, FileText, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
import { useMyBids, useBidsOnMyListings } from '@/hooks/useBids';
import { useContracts } from '@/hooks/useContracts';
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
  if (item.source === 'cargo_bid') return 'Cargo Bid';
  if (item.source === 'truck_booking') return 'Truck Booking';
  return item.typeBuckets.includes('delivery') ? 'Delivery Contract' : 'Contract';
}

function typeIcon(item) {
  if (item.source === 'cargo_bid') return <Package className="size-3.5" />;
  if (item.source === 'truck_booking') return <Truck className="size-3.5" />;
  if (item.typeBuckets.includes('delivery')) return <Truck className="size-3.5" />;
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

export function TruckerActivityView({
  currentUser,
  onOpenChat,
  onOpenContract,
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
    bids: myBids,
    loading: loadingMyBids,
    error: myBidsError,
  } = useMyBids(userId);
  const {
    bids: bidsOnMyListings,
    loading: loadingListingsBids,
    error: listingsBidsError,
  } = useBidsOnMyListings(userId);
  const {
    contracts,
    loading: loadingContracts,
    error: contractsError,
  } = useContracts(userId);

  const loading = loadingMyBids || loadingListingsBids || loadingContracts;
  const error = myBidsError || listingsBidsError || contractsError || '';

  const typeFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'cargo_bids', label: 'Cargo Bids' },
    { id: 'truck_bookings', label: 'Truck Bookings' },
    { id: 'contracts', label: 'Contracts' },
    { id: 'delivery', label: 'Delivery' },
  ]), []);

  const statusFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ]), []);

  const truckerPlacedCargoBids = useMemo(
    () => (myBids || []).filter((bid) => (
      inferBidPerspectiveRole(bid, userId) === 'trucker'
      && String(bid.listingType || '').toLowerCase() === 'cargo'
    )),
    [myBids, userId]
  );

  const truckerReceivedBookings = useMemo(
    () => (bidsOnMyListings || []).filter((bid) => (
      inferBidPerspectiveRole(bid, userId) === 'trucker'
      && String(bid.listingType || '').toLowerCase() === 'truck'
    )),
    [bidsOnMyListings, userId]
  );

  const truckerContracts = useMemo(
    () => (contracts || []).filter((contract) => inferContractPerspectiveRole(contract, userId) === 'trucker'),
    [contracts, userId]
  );

  const normalizedItems = useMemo(() => {
    const bidItems = truckerPlacedCargoBids.map((bid) => {
      const activityAt = getActivityTimestamp(bid, ['createdAt']);
      return {
        id: `cargo_bid:${bid.id}`,
        stableKey: `cargo_bid:${bid.id}`,
        source: 'cargo_bid',
        typeBuckets: ['cargo_bids'],
        status: normalizeBidStatus(bid.status),
        rawStatus: String(bid.status || '').toLowerCase(),
        activityAt,
        createdAt: activityAt,
        updatedAt: activityAt,
        origin: bid.origin || null,
        destination: bid.destination || null,
        amount: Number(bid.price || 0),
        counterpartyName: bid.listingOwnerName || 'Shipper',
        bidId: bid.id,
        listingId: bid.cargoListingId || bid.listingId || null,
        listingType: bid.listingType || 'cargo',
        listingOwnerId: bid.listingOwnerId || null,
        listingOwnerName: bid.listingOwnerName || null,
        rawEntity: bid,
      };
    });

    const bookingItems = truckerReceivedBookings.map((bid) => {
      const activityAt = getActivityTimestamp(bid, ['createdAt']);
      return {
        id: `truck_booking:${bid.id}`,
        stableKey: `truck_booking:${bid.id}`,
        source: 'truck_booking',
        typeBuckets: ['truck_bookings'],
        status: normalizeBidStatus(bid.status),
        rawStatus: String(bid.status || '').toLowerCase(),
        activityAt,
        createdAt: activityAt,
        updatedAt: activityAt,
        origin: bid.origin || null,
        destination: bid.destination || null,
        amount: Number(bid.price || 0),
        counterpartyName: bid.bidderName || 'Shipper',
        bidId: bid.id,
        listingId: bid.truckListingId || bid.listingId || null,
        listingType: bid.listingType || 'truck',
        listingOwnerId: bid.listingOwnerId || null,
        listingOwnerName: bid.listingOwnerName || null,
        rawEntity: bid,
      };
    });

    const contractItems = truckerContracts.map((contract) => {
      const activityAt = getActivityTimestamp(contract, ['completedAt', 'signedAt', 'createdAt']);
      const contractStatus = String(contract.status || '').toLowerCase();
      const typeBuckets = ['contracts'];
      if (['in_transit', 'completed'].includes(contractStatus)) {
        typeBuckets.push('delivery');
      }
      return {
        id: `contract:${contract.id}`,
        stableKey: `contract:${contract.id}`,
        source: 'contract',
        typeBuckets,
        status: normalizeContractStatus(contract.status),
        rawStatus: contractStatus,
        activityAt,
        createdAt: activityAt,
        updatedAt: activityAt,
        origin: contract.pickupCity || contract.pickupAddress || contract.origin || null,
        destination: contract.deliveryCity || contract.deliveryAddress || contract.destination || null,
        amount: Number(contract.agreedPrice || contract.price || 0),
        counterpartyName: getCounterpartyName(contract, userId),
        contractId: contract.id,
        bidId: contract.bidId || null,
        rawEntity: contract,
      };
    });

    const deduped = dedupeByStableKey([...bidItems, ...bookingItems, ...contractItems]);
    return sortEntitiesNewestFirst(deduped, { fallbackKeys: ['activityAt'] });
  }, [truckerPlacedCargoBids, truckerReceivedBookings, truckerContracts, userId]);

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
      cargoBids: scoped.filter((item) => item.typeBuckets.includes('cargo_bids')).length,
      truckBookings: scoped.filter((item) => item.typeBuckets.includes('truck_bookings')).length,
      contracts: scoped.filter((item) => item.typeBuckets.includes('contracts')).length,
      delivery: scoped.filter((item) => item.typeBuckets.includes('delivery')).length,
      completed: scoped.filter((item) => item.status === 'completed').length,
    };
  }, [normalizedItems, activeTypeFilter, activeStatusFilter]);

  const filterChipBase = 'inline-flex items-center justify-center rounded-full text-[13px] font-semibold leading-none transition-all duration-200 active:scale-95';
  const filterChipActive = 'text-white shadow-sm';
  const filterChipInactive = 'bg-gray-100 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-600 dark:hover:text-orange-400';
  const filterChipStyle = { padding: '7px 14px', minHeight: '32px', lineHeight: 1.1 };
  const filterChipActiveStyle = { background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)', boxShadow: '0 2px 8px rgba(249,115,22,0.3)' };

  const statCards = [
    { label: 'Total', value: summary.total, iconEl: <TrendingUp className="size-3.5 text-orange-500" />, iconBg: 'bg-orange-100 dark:bg-orange-950/40' },
    { label: 'Cargo Bids', value: summary.cargoBids, iconEl: <Package className="size-3.5 text-blue-500" />, iconBg: 'bg-blue-100 dark:bg-blue-950/40' },
    { label: 'Truck Bookings', value: summary.truckBookings, iconEl: <Truck className="size-3.5 text-purple-500" />, iconBg: 'bg-purple-100 dark:bg-purple-950/40' },
    { label: 'Contracts', value: summary.contracts, iconEl: <FileText className="size-3.5 text-indigo-500" />, iconBg: 'bg-indigo-100 dark:bg-indigo-950/40' },
    { label: 'Delivery', value: summary.delivery, iconEl: <Truck className="size-3.5 text-cyan-500" />, iconBg: 'bg-cyan-100 dark:bg-cyan-950/40' },
    { label: 'Completed', value: summary.completed, iconEl: <TrendingUp className="size-3.5 text-green-500" />, iconBg: 'bg-green-100 dark:bg-green-950/40' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Filter panel */}
      <div className="rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 p-4"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-1.5">
            {typeFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTypeFilter(f.id)}
                style={{ ...filterChipStyle, ...(activeTypeFilter === f.id ? filterChipActiveStyle : {}) }}
                className={`${filterChipBase} ${activeTypeFilter === f.id ? filterChipActive : filterChipInactive}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="h-px bg-gray-100 dark:bg-gray-700/60" />
          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                style={{ ...filterChipStyle, ...(activeStatusFilter === f.id ? filterChipActiveStyle : {}) }}
                className={`${filterChipBase} ${activeStatusFilter === f.id ? filterChipActive : filterChipInactive}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {statCards.map(({ label, value, iconEl, iconBg }) => (
          <div
            key={label}
            className="rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 p-3"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
          >
            <div className={`size-7 rounded-xl ${iconBg} flex items-center justify-center mb-2`}>
              {iconEl}
            </div>
            <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-0.5 leading-none">{label}</p>
            <p className="text-xl font-black text-gray-900 dark:text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Activity list */}
      <div className="rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 overflow-hidden"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
        {loading ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 className="size-5 animate-spin text-orange-500" />
            <p className="text-sm">Loading activity...</p>
          </div>
        ) : error ? (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-red-700 dark:text-red-300 p-4 text-sm">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center gap-4 text-center px-6">
            <div
              className="size-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid #fed7aa' }}
            >
              <TrendingUp className="size-6 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">No activity yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">No trucker activity for the selected filters.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onBrowseMarketplace}
                className="h-9 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Browse Cargo
              </button>
              <button
                type="button"
                onClick={onCreateListing}
                className="h-9 px-4 rounded-xl text-sm font-bold text-white transition-all active:scale-95 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}
              >
                Post Truck
              </button>
              <button
                type="button"
                onClick={onOpenMessages}
                className="h-9 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Open Messages
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.contractId) { onOpenContract?.(item.contractId); return; }
                  if (!item.bidId) return;
                  onOpenChat?.(item.rawEntity, {
                    id: item.listingId,
                    listingType: item.listingType,
                    origin: item.origin,
                    destination: item.destination,
                    userId: item.listingOwnerId,
                    userName: item.listingOwnerName,
                  });
                }}
                className="w-full text-left px-4 py-3.5 transition-colors hover:bg-orange-50/60 dark:hover:bg-orange-950/20 active:bg-orange-50 dark:active:bg-orange-950/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="shrink-0 size-9 rounded-xl flex items-center justify-center text-orange-500"
                      style={{ background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid #fed7aa' }}
                    >
                      {typeIcon(item)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                        {typeLabel(item)}
                      </p>
                      {(item.origin || item.destination) && (
                        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          <span className="truncate max-w-[90px]">{item.origin || '-'}</span>
                          <ArrowRight className="size-3 shrink-0 text-orange-300" />
                          <span className="truncate max-w-[90px]">{item.destination || '-'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                  {item.counterpartyName && (
                    <span>
                      With: <span className="text-gray-600 dark:text-gray-300 font-semibold">{item.counterpartyName}</span>
                    </span>
                  )}
                  {formatAmount(item.amount) && (
                    <span className="font-semibold text-gray-600 dark:text-gray-300">{formatAmount(item.amount)}</span>
                  )}
                  {item.activityAt && (
                    <span className="flex items-center gap-1 ml-auto text-gray-400 dark:text-gray-500">
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

export default TruckerActivityView;
