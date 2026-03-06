import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Package, Truck, FileText, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { dedupeAndSortNewest } from '@/utils/activitySorting';
import { activityPillClass, activityPillRowClass } from './activityPills';

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

function statusBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending') return 'warning';
  if (['accepted', 'contracted', 'signed', 'in_transit', 'picked_up'].includes(normalized)) return 'success';
  if (['completed', 'delivered'].includes(normalized)) return 'gradient-blue';
  return 'destructive';
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-primary">
            {typeIcon(item.activityType, item)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {typeLabel(item.activityType, item)}
            </p>
            {(item.origin || item.destination) && (
              <div className="mt-0.5 flex items-center gap-1 text-xs font-normal text-muted-foreground">
                <span className="max-w-[88px] truncate">{item.origin || '-'}</span>
                <ArrowRight className="size-3 shrink-0" />
                <span className="max-w-[88px] truncate">{item.destination || '-'}</span>
              </div>
            )}
          </div>
        </div>
        <Badge variant={statusBadgeVariant(item.statusBucket || item.status)} className="shrink-0 capitalize">
          {titleCase(String(item.statusBucket || item.status || 'pending'))}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs font-normal text-muted-foreground">
        {item.referredUserMasked && (
          <span>User: <span className="font-medium text-foreground">{item.referredUserMasked}</span></span>
        )}
        {item.counterpartyMasked && (
          <span>Counterparty: <span className="font-medium text-foreground">{item.counterpartyMasked}</span></span>
        )}
        {item.amount ? (
          <span>Amount: <span className="font-medium text-foreground">PHP {Number(item.amount).toLocaleString()}</span></span>
        ) : null}
        {item.activityAt && (
          <span className="ml-auto flex items-center gap-1">
            <Calendar className="size-3" />
            {formatDate(item.activityAt)}
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-6">
        <div className="flex flex-col gap-3">
          <div className={activityPillRowClass}>
            {typeFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setTypeFilter(filter.id)}
                aria-pressed={activeTypeFilter === filter.id}
                className={activityPillClass(activeTypeFilter === filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className={activityPillRowClass}>
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                aria-pressed={activeStatusFilter === filter.id}
                className={activityPillClass(activeStatusFilter === filter.id)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full rounded-xl px-4 py-2 text-sm font-medium lg:min-h-10 lg:w-auto"
              onClick={handleBackfill}
              disabled={backfilling}
            >
              {backfilling ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Backfill
            </Button>
          </div>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Total', value: summary.total || 0, icon: <TrendingUp className="size-3.5 text-orange-500" />, bg: 'bg-orange-50 dark:bg-orange-950/30' },
            { label: 'Referred Cargo', value: summary?.byType?.referred_cargo || 0, icon: <Package className="size-3.5 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'Referred Truck', value: summary?.byType?.referred_truck || 0, icon: <Truck className="size-3.5 text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-950/30' },
            { label: 'Completed', value: summary?.byStatus?.completed || 0, icon: <TrendingUp className="size-3.5 text-green-500" />, bg: 'bg-green-50 dark:bg-green-950/30' },
          ].map(({ label, value, icon, bg }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                  {icon}
                </span>
                <p className="text-sm font-normal text-muted-foreground">{label}</p>
              </div>
              <p className="text-2xl font-semibold leading-none text-foreground">{value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-6">
        {loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-sm font-normal">Loading broker activity...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="flex size-16 items-center justify-center rounded-xl bg-gradient-to-br from-muted to-secondary shadow-sm">
              <TrendingUp className="size-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-normal text-muted-foreground">No broker activity yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const canOpen = Boolean(onOpenListing && isOpenableListing(item));
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
                    className="w-full rounded-2xl border border-border bg-secondary/60 p-4 text-left transition-all duration-200 hover:bg-muted"
                  >
                    {renderItemBody(item)}
                  </button>
                );
              }

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-secondary/60 p-4"
                >
                  {renderItemBody(item)}
                </div>
              );
            })}
          </div>
        )}

        {hasMore && !loading && (
          <Button
            variant="outline"
            className="mt-3 w-full"
            onClick={() => loadActivity({ append: true, cursorValue: cursor })}
          >
            Load more
          </Button>
        )}

        {loading && items.length > 0 && (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-primary" />
          </div>
        )}
      </div>
    </div>
  );
}

export default BrokerActivityView;
