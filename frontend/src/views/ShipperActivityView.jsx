import { useMemo, useState } from 'react';
import { Loader2, Package, Truck, FileText, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import { useBidsOnMyListings, useMyBids } from '@/hooks/useBids';
import { useContracts } from '@/hooks/useContracts';
import { useCargoListings } from '@/hooks/useCargoListings';
import { inferBidPerspectiveRole, inferContractPerspectiveRole, resolveBidListingType } from '@/utils/workspace';
import { getCanonicalTimestamp, sortEntitiesNewestFirst } from '@/utils/activitySorting';
import { isActiveBidStatus } from '@/utils/bidStatus';

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

function normalizeShipmentStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'picked_up' || normalized === 'in_transit') return 'accepted';
  if (normalized === 'delivered') return 'completed';
  if (normalized === 'cancelled') return 'cancelled';
  if (normalized === 'pending' || normalized === 'pending_pickup') return 'pending';
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
  if (item.source === 'truck_booking') return 'Truck Booking';
  return item.typeBuckets.includes('shipment') ? 'Shipment' : 'Contract';
}

function typeIcon(item) {
  if (item.source === 'cargo') return <Package className="size-3.5" />;
  if (item.source === 'bid' || item.source === 'truck_booking') return <Truck className="size-3.5" />;
  if (item.typeBuckets.includes('shipment')) return <Truck className="size-3.5" />;
  return <FileText className="size-3.5" />;
}

function iconStyle(item) {
  if (item.source === 'contract' || item.typeBuckets?.includes('contracts'))
    return { background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)', border: '1px solid #c7d2fe', color: '#6366f1' };
  if (item.source === 'truck_booking' || item.typeBuckets?.includes('shipment') || item.typeBuckets?.includes('delivery'))
    return { background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '1px solid #bbf7d0', color: '#22c55e' };
  if (item.source === 'bid' || item.typeBuckets?.includes('bids'))
    return { background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #bfdbfe', color: '#3b82f6' };
  // cargo default — orange
  return { background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', border: '1px solid #fed7aa', color: '#f97316' };
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
  shipments = [],
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
  const { bids: myBids, loading: loadingMyBids } = useMyBids(userId);
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

  const loading = loadingBids || loadingContracts || loadingCargo || loadingMyBids;
  const error = bidsError || contractsError || cargoError || '';

  const typeFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'cargo', label: 'Cargo' },
    { id: 'bids', label: 'Bids' },
    { id: 'truck_bookings', label: 'Truck Bookings' },
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
      && resolveBidListingType(bid) === 'cargo'
      && isActiveBidStatus(bid.status)
    )),
    [bidsOnMyListings, userId]
  );

  const shipperCargoPosts = useMemo(
    () => (cargoListings || []).filter((cargo) => (
      cargo?.userId === userId || cargo?.shipperId === userId
    )),
    [cargoListings, userId]
  );

  const shipperTruckBookings = useMemo(
    () => (myBids || []).filter((bid) => (
      resolveBidListingType(bid) === 'truck'
      && isActiveBidStatus(bid.status)
    )),
    [myBids]
  );

  const shipperContracts = useMemo(
    () => (contracts || []).filter((contract) => (
      inferContractPerspectiveRole(contract, userId) === 'shipper'
      && String(contract?.status || '').toLowerCase() !== 'cancelled'
    )),
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
        listingType: resolveBidListingType(bid) || 'cargo',
        listingOwnerId: bid.listingOwnerId || null,
        listingOwnerName: bid.listingOwnerName || null,
        rawEntity: bid,
      };
    });

    const contractItems = shipperContracts.map((contract) => {
      const activityAt = getActivityTimestamp(contract, ['completedAt', 'signedAt', 'createdAt']);
      const rawStatus = String(contract.status || '').toLowerCase();
      return {
        id: `contract:${contract.id}`,
        stableKey: `contract:${contract.id}`,
        source: 'contract',
        typeBuckets: ['contracts'],
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

    const shipmentItems = (shipments || []).map((shipment) => {
      const activityAt = getActivityTimestamp(shipment, ['deliveredAt', 'updatedAt', 'createdAt']);
      const rawStatus = String(shipment.status || '').toLowerCase();
      return {
        id: `shipment:${shipment.id}`,
        stableKey: `shipment:${shipment.id}`,
        source: 'shipment',
        typeBuckets: ['shipment'],
        status: normalizeShipmentStatus(shipment.status),
        rawStatus,
        activityAt,
        origin: shipment.origin || null,
        destination: shipment.destination || null,
        amount: Number(shipment.agreedPrice || shipment.contractValue || shipment.price || 0),
        counterpartyName: shipment.truckerName || shipment.trucker || 'Trucker',
        contractId: shipment.contractId || null,
        shipmentId: shipment.id,
        rawEntity: shipment,
      };
    });

    const truckBookingItems = shipperTruckBookings.map((bid) => {
      const activityAt = getActivityTimestamp(bid, ['createdAt']);
      return {
        id: `truck_booking:${bid.id}`,
        stableKey: `truck_booking:${bid.id}`,
        source: 'truck_booking',
        typeBuckets: ['truck_bookings'],
        status: normalizeBidStatus(bid.status),
        rawStatus: String(bid.status || '').toLowerCase(),
        activityAt,
        origin: bid.origin || null,
        destination: bid.destination || null,
        amount: Number(bid.price || 0),
        counterpartyName: bid.listingOwnerName || 'Trucker',
        bidId: bid.id,
        listingId: bid.truckListingId || bid.listingId || null,
        listingType: 'truck',
        listingOwnerId: bid.listingOwnerId || null,
        listingOwnerName: bid.listingOwnerName || null,
        rawEntity: bid,
      };
    });

    const deduped = dedupeByStableKey([...cargoItems, ...bidItems, ...contractItems, ...shipmentItems, ...truckBookingItems]);
    return sortEntitiesNewestFirst(deduped, { fallbackKeys: ['activityAt'] });
  }, [shipperCargoPosts, shipperIncomingCargoBids, shipperContracts, shipperTruckBookings, shipments, userId]);

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
      truck_bookings: scoped.filter((item) => item.typeBuckets.includes('truck_bookings')).length,
      shipment: scoped.filter((item) => item.typeBuckets.includes('shipment')).length,
      contracts: scoped.filter((item) => item.typeBuckets.includes('contracts')).length,
      completed: scoped.filter((item) => item.status === 'completed').length,
    };
  }, [normalizedItems, activeTypeFilter, activeStatusFilter]);

  const statCards = [
    { label: 'Total', value: summary.total, iconEl: <TrendingUp className="size-3.5 text-orange-500" />, iconBg: 'bg-orange-100 dark:bg-orange-950/40' },
    { label: 'Cargo', value: summary.cargo, iconEl: <Package className="size-3.5 text-blue-500" />, iconBg: 'bg-blue-100 dark:bg-blue-950/40' },
    { label: 'Bids', value: summary.bids, iconEl: <Truck className="size-3.5 text-purple-500" />, iconBg: 'bg-purple-100 dark:bg-purple-950/40' },
    { label: 'Bookings', value: summary.truck_bookings, iconEl: <Truck className="size-3.5 text-green-500" />, iconBg: 'bg-green-100 dark:bg-green-950/40' },
    { label: 'Contracts', value: summary.contracts, iconEl: <FileText className="size-3.5 text-indigo-500" />, iconBg: 'bg-indigo-100 dark:bg-indigo-950/40' },
    { label: 'Completed', value: summary.completed, iconEl: <TrendingUp className="size-3.5 text-green-500" />, iconBg: 'bg-green-100 dark:bg-green-950/40' },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={activeTypeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className={cn("h-12 flex-1 rounded-[8px] border-gray-200 bg-white text-sm font-semibold dark:border-gray-700 dark:bg-gray-800")}>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="rounded-[8px]">
            {typeFilters.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeStatusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={cn("h-12 flex-1 rounded-[8px] border-gray-200 bg-white text-sm font-semibold dark:border-gray-700 dark:bg-gray-800")}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-[8px]">
            {statusFilters.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats grid — 6 cards, 3 cols = 2 clean rows */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
        {statCards.map(({ label, value, iconEl, iconBg }, idx) => (
          <div
            key={label}
            className="rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 relative overflow-hidden flex flex-col justify-center"
            style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '10px 10px 10px 12px', minHeight: '76px' }}
          >
            {idx === 0 && (
              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: 'linear-gradient(180deg, #FF9A56, #FF6B35)' }} />
            )}
            <div className={`size-6 rounded-lg ${iconBg} flex items-center justify-center mb-1.5 shrink-0`}>
              {iconEl}
            </div>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 leading-tight truncate mb-0.5">{label}</p>
            <p className="text-[18px] font-black text-gray-900 dark:text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Activity list */}
      <div
        className="rounded-2xl bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700/60 p-3"
        style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}
      >
        {loading ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2 text-gray-400">
            <Loader2 className="size-5 animate-spin text-orange-500" />
            <p className="text-sm">Loading activity...</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 text-red-700 dark:text-red-300 p-4 text-sm">
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
              <p className="text-xs text-gray-400 dark:text-gray-500">No shipper activity for the selected filters.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={onBrowseMarketplace}
                className="h-9 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
                Browse Trucks
              </button>
              <button type="button" onClick={onCreateListing}
                className="h-9 px-4 rounded-xl text-sm font-bold text-white transition-all active:scale-95 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)' }}>
                Post Cargo
              </button>
              <button type="button" onClick={onOpenMessages}
                className="h-9 px-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
                Open Messages
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.contractId) { onOpenContract?.(item.contractId); return; }
                  if (item.bidId) {
                    onOpenChat?.(item.rawEntity, {
                      id: item.listingId,
                      listingType: item.listingType,
                      origin: item.origin,
                      destination: item.destination,
                      userId: item.listingOwnerId,
                      userName: item.listingOwnerName,
                    });
                    return;
                  }
                  if (item.source === 'cargo') { onOpenListing?.(item.rawEntity); }
                }}
                className="w-full text-left p-4 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-100 dark:border-gray-700/60 transition-all duration-150 hover:border-orange-200 dark:hover:border-orange-800/60 hover:shadow-md active:scale-[0.99]"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
              >
                {/* Row 1: icon + label + status badge */}
                <div className="flex items-center gap-3">
                  <div
                    className="shrink-0 size-9 rounded-xl flex items-center justify-center"
                    style={iconStyle(item)}
                  >
                    {typeIcon(item)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                      {typeLabel(item)}
                    </p>
                    {(item.origin || item.destination) && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        <span className="truncate max-w-[100px] sm:max-w-[180px]">{item.origin || '-'}</span>
                        <ArrowRight className="size-3 shrink-0 text-orange-300" />
                        <span className="truncate max-w-[100px] sm:max-w-[180px]">{item.destination || '-'}</span>
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold capitalize leading-none ${statusClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>

                {/* Row 2: meta info */}
                <div className="mt-2.5 ml-12 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
                  {item.counterpartyName && (
                    <span>With: <span className="text-gray-600 dark:text-gray-300 font-semibold">{item.counterpartyName}</span></span>
                  )}
                  {formatAmount(item.amount) && (
                    <span className="font-bold" style={{ color: '#FF6B35' }}>{formatAmount(item.amount)}</span>
                  )}
                  {item.activityAt && (
                    <span className="flex items-center gap-1 ml-auto">
                      <Calendar className="size-3 shrink-0" />
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
