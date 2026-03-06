import { useMemo, useState } from 'react';
import { Loader2, Package, Truck, FileText, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

function statusBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'warning';
  if (normalized === 'accepted') return 'info';
  if (normalized === 'completed') return 'success';
  return 'destructive';
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

  const chipBase = 'inline-flex items-center justify-center rounded-full text-[13px] font-semibold leading-none transition-all duration-200 active:scale-95 px-3.5 py-2';
  const chipActiveClass = 'text-white shadow-sm';
  const chipInactive = 'bg-muted text-muted-foreground hover:bg-accent';
  const chipActiveStyle = { background: 'linear-gradient(to right, #fb923c, #ea580c)' };

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="rounded-xl bg-card border border-border p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {typeFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTypeFilter(filter.id)}
                className={`${chipBase} ${activeTypeFilter === filter.id ? chipActiveClass : chipInactive}`}
                style={activeTypeFilter === filter.id ? chipActiveStyle : undefined}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                className={`${chipBase} ${activeStatusFilter === filter.id ? chipActiveClass : chipInactive}`}
                style={activeStatusFilter === filter.id ? chipActiveStyle : undefined}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: summary.total, icon: <TrendingUp className="size-3.5 text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-950/30' },
          { label: 'Cargo Bids', value: summary.cargoBids, icon: <Package className="size-3.5 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-950/30' },
          { label: 'Truck Bookings', value: summary.truckBookings, icon: <Truck className="size-3.5 text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-950/30' },
          { label: 'Contracts', value: summary.contracts, icon: <FileText className="size-3.5 text-indigo-500" />, bg: 'bg-indigo-50 dark:bg-indigo-950/30' },
          { label: 'Delivery', value: summary.delivery, icon: <Truck className="size-3.5 text-cyan-500" />, bg: 'bg-cyan-50 dark:bg-cyan-950/30' },
          { label: 'Completed', value: summary.completed, icon: <TrendingUp className="size-3.5 text-green-500" />, bg: 'bg-green-50 dark:bg-green-950/30' },
        ].map(({ label, value, icon, bg }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className={`size-6 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                {icon}
              </span>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
            <p className="text-lg font-bold text-foreground leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Activity list */}
      <div className="rounded-xl bg-card border border-border p-4">
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-sm">Loading trucker activity...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-4 text-sm">
            {error}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
            <div className="size-12 rounded-2xl bg-muted flex items-center justify-center">
              <TrendingUp className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              No trucker activity for the selected filters.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onBrowseMarketplace}>
                Browse Cargo
              </Button>
              <Button type="button" variant="gradient" size="sm" onClick={onCreateListing}>
                Post Truck
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
                  if (!item.bidId) return;
                  const listingData = {
                    id: item.listingId,
                    listingType: item.listingType,
                    origin: item.origin,
                    destination: item.destination,
                    userId: item.listingOwnerId,
                    userName: item.listingOwnerName,
                  };
                  onOpenChat?.(item.rawEntity, listingData);
                }}
                className="w-full text-left rounded-xl border border-border bg-secondary hover:bg-muted transition-all duration-200 p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="shrink-0 size-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-primary">
                      {typeIcon(item)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {typeLabel(item)}
                      </p>
                      {(item.origin || item.destination) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate max-w-[80px]">{item.origin || '-'}</span>
                          <ArrowRight className="size-3 shrink-0" />
                          <span className="truncate max-w-[80px]">{item.destination || '-'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusBadgeVariant(item.status)} size="sm" className="shrink-0 capitalize">
                    {item.status}
                  </Badge>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-border flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {item.counterpartyName && (
                    <span>
                      Counterparty: <span className="text-foreground font-medium">{item.counterpartyName}</span>
                    </span>
                  )}
                  {formatAmount(item.amount) && (
                    <span>
                      Amount: <span className="text-foreground font-medium">{formatAmount(item.amount)}</span>
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

export default TruckerActivityView;
