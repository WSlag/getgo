import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Package, Truck, FileText, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import api from '@/services/api';
import { dedupeAndSortNewest } from '@/utils/activitySorting';

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

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (normalized === 'accepted' || normalized === 'contracted' || normalized === 'signed' || normalized === 'in_transit' || normalized === 'picked_up') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }
  if (normalized === 'completed' || normalized === 'delivered') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

function titleCase(value) {
  return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function shipmentLifecycleLabel(prefix, shipmentStatus) {
  const normalized = String(shipmentStatus || '').toLowerCase();
  if (!normalized) return `${prefix} Update`;
  if (normalized === 'pending_pickup') return `${prefix} Pending Pickup`;
  return `${prefix} ${titleCase(normalized)}`;
}

function typeLabel(activityType, item) {
  if (activityType === 'cargo_bid') return 'Cargo Bid';
  if (activityType === 'truck_booking_bid') return 'Truck Booking';
  if (activityType === 'cargo_shipment_status') return shipmentLifecycleLabel('Shipment', item?.shipmentStatus);
  if (activityType === 'truck_delivery_status') return shipmentLifecycleLabel('Delivery', item?.shipmentStatus);
  if (activityType === 'cargo_contract_created') return 'Cargo Contract Created';
  if (activityType === 'cargo_contract_signed') return 'Cargo Contract Signed';
  if (activityType === 'cargo_contract_completed') return 'Cargo Contract Completed';
  if (activityType === 'cargo_contract_cancelled') return 'Cargo Contract Cancelled';
  if (activityType === 'truck_booking_contract_created') return 'Truck Contract Created';
  if (activityType === 'truck_booking_contract_signed') return 'Truck Contract Signed';
  if (activityType === 'truck_booking_contract_completed') return 'Truck Contract Completed';
  if (activityType === 'truck_booking_contract_cancelled') return 'Truck Contract Cancelled';
  return 'Activity';
}

function typeIcon(activityType, item) {
  const bucket = String(item?.typeBucket || '').toLowerCase();
  if (
    bucket === 'referred_cargo'
    || activityType === 'cargo_bid'
    || activityType === 'cargo_shipment_status'
    || String(activityType || '').startsWith('cargo_')
  ) {
    return <Package className="size-3.5" />;
  }

  if (
    bucket === 'referred_truck'
    || activityType === 'truck_booking_bid'
    || activityType === 'truck_delivery_status'
    || String(activityType || '').startsWith('truck_')
  ) {
    return <Truck className="size-3.5" />;
  }

  return <FileText className="size-3.5" />;
}

function isOpenableListing(item) {
  const listingType = String(item?.listingType || '').toLowerCase();
  return Boolean(item?.listingId && (listingType === 'cargo' || listingType === 'truck'));
}

export function BrokerActivityView({
  onToast,
  onOpenListing,
  typeFilter,
  statusFilter,
  onTypeFilterChange,
  onStatusFilterChange,
}) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [internalTypeFilter, setInternalTypeFilter] = useState('all');
  const [internalStatusFilter, setInternalStatusFilter] = useState('all');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const requestSequenceRef = useRef(0);
  const isMountedRef = useRef(true);
  const activeTypeFilter = typeFilter || internalTypeFilter;
  const activeStatusFilter = statusFilter || internalStatusFilter;
  const setTypeFilter = onTypeFilterChange || setInternalTypeFilter;
  const setStatusFilter = onStatusFilterChange || setInternalStatusFilter;

  const typeFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'referred_cargo', label: 'Referred Cargo' },
    { id: 'referred_truck', label: 'Referred Truck' },
  ]), []);

  const statusFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ]), []);

  const loadActivity = useCallback(async ({ append = false, cursorValue = null } = {}) => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    setLoading(true);
    setError('');
    if (!append) {
      setItems([]);
      setSummary(null);
      setCursor(null);
      setHasMore(false);
    }

    try {
      const response = await api.broker.getMarketplaceActivity({
        typeFilter: activeTypeFilter,
        statusFilter: activeStatusFilter,
        limit: 20,
        cursor: cursorValue,
      });

      if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
        return;
      }

      setItems((prev) => (
        append
          ? dedupeAndSortNewest(prev, response?.items || [], { fallbackKeys: ['activityAt'] })
          : dedupeAndSortNewest([], response?.items || [], { fallbackKeys: ['activityAt'] })
      ));
      setSummary(response?.summary || null);
      setCursor(response?.nextCursor || null);
      setHasMore(Boolean(response?.hasMore));
    } catch (fetchError) {
      if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
        return;
      }
      setError(fetchError.message || 'Failed to load broker activity');
    } finally {
      if (isMountedRef.current && requestSequenceRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [activeTypeFilter, activeStatusFilter]);

  useEffect(() => {
    loadActivity({ append: false, cursorValue: null });
  }, [loadActivity]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const response = await api.broker.backfillMarketplaceActivity({});
      onToast?.({
        type: 'success',
        title: 'Backfill complete',
        message: `Created ${response?.created || 0}, Updated ${response?.updated || 0}, Skipped ${response?.skipped || 0}`,
      });
      await loadActivity({ append: false, cursorValue: null });
    } catch (backfillError) {
      onToast?.({
        type: 'error',
        title: 'Backfill failed',
        message: backfillError.message || 'Please try again.',
      });
    } finally {
      setBackfilling(false);
    }
  };

  const renderItemBody = (item) => (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0 size-8 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-500" style={{ boxShadow: '0 1px 4px rgba(249,115,22,0.15)' }}>
            {typeIcon(item.activityType, item)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-snug">
              {typeLabel(item.activityType, item)}
            </p>
            {(item.origin || item.destination) && (
              <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                <span className="truncate max-w-[80px]">{item.origin || '-'}</span>
                <ArrowRight className="size-3 shrink-0 text-orange-400" />
                <span className="truncate max-w-[80px]">{item.destination || '-'}</span>
              </div>
            )}
          </div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${statusClass(item.statusBucket || item.status)}`}>
          {String(item.statusBucket || item.status || 'pending')}
        </span>
      </div>

      <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400 dark:text-gray-500">
        {item.referredUserMasked && (
          <span>User: <span className="text-gray-600 dark:text-gray-300 font-medium">{item.referredUserMasked}</span></span>
        )}
        {item.counterpartyMasked && (
          <span>Counterparty: <span className="text-gray-600 dark:text-gray-300 font-medium">{item.counterpartyMasked}</span></span>
        )}
        {item.amount ? (
          <span>Amount: <span className="text-gray-700 dark:text-gray-200 font-semibold">PHP {Number(item.amount).toLocaleString()}</span></span>
        ) : null}
        {item.activityAt && (
          <span className="flex items-center gap-1 ml-auto">
            <Calendar className="size-3" />
            {formatDate(item.activityAt)}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={activeTypeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className={cn("h-10 flex-1 rounded-[8px] border-gray-200 bg-white text-sm font-semibold dark:border-gray-700 dark:bg-gray-800")}>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="rounded-[8px]">
            {typeFilters.map((filter) => (
              <SelectItem key={filter.id} value={filter.id}>{filter.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={activeStatusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className={cn("h-10 flex-1 rounded-[8px] border-gray-200 bg-white text-sm font-semibold dark:border-gray-700 dark:bg-gray-800")}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-[8px]">
            {statusFilters.map((filter) => (
              <SelectItem key={filter.id} value={filter.id}>{filter.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={handleBackfill}
          disabled={backfilling}
          className="shrink-0 h-10 px-3 inline-flex items-center gap-1.5 rounded-[8px] text-[13px] font-semibold border border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:text-orange-500 transition-all duration-200 active:scale-95 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          {backfilling ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Backfill
        </button>
      </div>

      {/* Stats Grid */}
      {summary && (
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { label: 'Total', value: summary.total || 0, icon: <TrendingUp className="size-4 text-orange-500" />, iconBg: 'bg-orange-50 dark:bg-orange-950/40' },
            { label: 'Referred Cargo', value: summary?.byType?.referred_cargo || 0, icon: <Package className="size-4 text-blue-500" />, iconBg: 'bg-blue-50 dark:bg-blue-950/40' },
            { label: 'Referred Truck', value: summary?.byType?.referred_truck || 0, icon: <Truck className="size-4 text-purple-500" />, iconBg: 'bg-purple-50 dark:bg-purple-950/40' },
            { label: 'Completed', value: summary?.byStatus?.completed || 0, icon: <TrendingUp className="size-4 text-green-500" />, iconBg: 'bg-green-50 dark:bg-green-950/40' },
          ].map(({ label, value, icon, iconBg }) => (
            <div key={label} className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3.5" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              <div className={`size-9 rounded-xl ${iconBg} flex items-center justify-center mb-2`}>
                {icon}
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mb-0.5">{label}</p>
              <p className="text-2xl font-black text-gray-900 dark:text-white leading-none" style={{ fontFamily: 'Outfit, sans-serif' }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Activity List */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        {loading && items.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2 text-gray-500">
            <Loader2 className="size-5 animate-spin text-orange-500" />
            <p className="text-sm">Loading broker activity...</p>
          </div>
        ) : error ? (
          <div className="m-4 rounded-xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 p-4 text-sm">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="py-14 flex flex-col items-center justify-center gap-3">
            <div className="size-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF9A56 0%, #FF6B35 100%)', boxShadow: '0 4px 16px rgba(249,115,22,0.3)' }}>
              <TrendingUp className="size-6 text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No broker activity yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Refer users to start earning commissions</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const canOpen = Boolean(onOpenListing && isOpenableListing(item));
              const rowClass = 'w-full text-left px-4 py-3.5 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/20 active:bg-orange-100 dark:active:bg-orange-950/30';
              const body = renderItemBody(item);
              if (canOpen) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onOpenListing({
                        ...item,
                        id: item.listingId,
                        listingId: item.listingId,
                        listingType: item.listingType,
                        type: item.listingType,
                      });
                    }}
                    className={rowClass}
                  >
                    {body}
                  </button>
                );
              }
              return (
                <div key={item.id} className="px-4 py-3.5">
                  {body}
                </div>
              );
            })}
          </div>
        )}

        {hasMore && !loading && (
          <div className="p-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => loadActivity({ append: true, cursorValue: cursor })}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-orange-500 border border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors"
            >
              Load more
            </button>
          </div>
        )}

        {loading && items.length > 0 && (
          <div className="flex justify-center py-3 border-t border-gray-100 dark:border-gray-800">
            <Loader2 className="size-4 animate-spin text-orange-500" />
          </div>
        )}
      </div>
    </div>
  );
}

export default BrokerActivityView;
