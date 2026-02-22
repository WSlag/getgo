import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Package, Truck, FileText, TrendingUp, ArrowRight, Calendar } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';

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
  if (normalized === 'accepted' || normalized === 'contracted' || normalized === 'signed') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  if (normalized === 'completed' || normalized === 'delivered') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

function typeLabel(activityType) {
  if (activityType === 'cargo_bid') return 'Cargo Bid';
  if (activityType === 'truck_booking_bid') return 'Truck Booking';
  if (activityType === 'truck_booking_contract_created') return 'Contract Created';
  if (activityType === 'truck_booking_contract_signed') return 'Contract Signed';
  if (activityType === 'truck_booking_contract_completed') return 'Contract Completed';
  if (activityType === 'truck_booking_contract_cancelled') return 'Contract Cancelled';
  return 'Activity';
}

function typeIcon(activityType) {
  if (activityType === 'cargo_bid') return <Package className="size-3.5" />;
  if (activityType === 'truck_booking_bid') return <Truck className="size-3.5" />;
  return <FileText className="size-3.5" />;
}

export function BrokerActivityView({ onToast }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  const typeFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'cargo_bids', label: 'Cargo Bids' },
    { id: 'truck_bookings', label: 'Truck Bookings' },
    { id: 'contracts', label: 'Contracts' },
  ]), []);

  const statusFilters = useMemo(() => ([
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'accepted', label: 'Accepted' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ]), []);

  const loadActivity = async ({ append = false, cursorValue = null } = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.broker.getMarketplaceActivity({
        typeFilter,
        statusFilter,
        limit: 20,
        cursor: cursorValue,
      });
      setItems((prev) => (append ? [...prev, ...(response?.items || [])] : (response?.items || [])));
      setSummary(response?.summary || null);
      setCursor(response?.nextCursor || null);
      setHasMore(Boolean(response?.hasMore));
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load broker activity');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity({ append: false, cursorValue: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, statusFilter]);

  const handleBackfill = async () => {
    setBackfilling(true);
    try {
      const response = await api.broker.backfillMarketplaceActivity({});
      onToast?.({
        type: 'success',
        title: 'Backfill complete',
        message: `Created ${response?.created || 0}, Updated ${response?.updated || 0}, Skipped ${response?.skipped || 0}`,
      });
      loadActivity({ append: false, cursorValue: null });
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

  return (
    <div className="space-y-4">
      {/* Filters row */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {typeFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setTypeFilter(filter.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                typeFilter === filter.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-orange-300 dark:hover:border-orange-800'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setStatusFilter(filter.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                statusFilter === filter.id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-orange-300 dark:hover:border-orange-800'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Backfill button */}
      <div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-8"
          onClick={handleBackfill}
          disabled={backfilling}
        >
          {backfilling ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Backfill History
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Total', value: summary.total || 0, icon: <TrendingUp className="size-3.5 text-orange-500" /> },
            { label: 'Cargo Bids', value: summary?.byType?.cargo_bids || 0, icon: <Package className="size-3.5 text-blue-500" /> },
            { label: 'Truck Bookings', value: summary?.byType?.truck_bookings || 0, icon: <Truck className="size-3.5 text-purple-500" /> },
            { label: 'Contracts', value: summary?.byType?.contracts || 0, icon: <FileText className="size-3.5 text-indigo-500" /> },
            { label: 'Completed', value: summary?.byStatus?.completed || 0, icon: <TrendingUp className="size-3.5 text-green-500" /> },
          ].map(({ label, value, icon }) => (
            <div
              key={label}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3"
            >
              <div className="flex items-center gap-1.5 mb-1">
                {icon}
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white leading-none">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading && items.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-gray-500">
          <Loader2 className="size-5 animate-spin text-orange-500" />
          <p className="text-sm">Loading broker activity...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 p-4 text-sm">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <div className="size-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <TrendingUp className="size-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">No broker activity yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="shrink-0 size-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-orange-500">
                    {typeIcon(item.activityType)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {typeLabel(item.activityType)}
                    </p>
                    {(item.origin || item.destination) && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        <span className="truncate max-w-[80px]">{item.origin || '—'}</span>
                        <ArrowRight className="size-3 shrink-0" />
                        <span className="truncate max-w-[80px]">{item.destination || '—'}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusClass(item.status)}`}>
                  {String(item.status || 'pending')}
                </span>
              </div>

              <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                {item.referredUserMasked && (
                  <span>User: <span className="text-gray-700 dark:text-gray-300 font-medium">{item.referredUserMasked}</span></span>
                )}
                {item.counterpartyMasked && (
                  <span>Counterparty: <span className="text-gray-700 dark:text-gray-300 font-medium">{item.counterpartyMasked}</span></span>
                )}
                {item.amount ? (
                  <span>Amount: <span className="text-gray-700 dark:text-gray-300 font-medium">₱{Number(item.amount).toLocaleString()}</span></span>
                ) : null}
                {item.activityAt && (
                  <span className="flex items-center gap-1 ml-auto">
                    <Calendar className="size-3" />
                    {formatDate(item.activityAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => loadActivity({ append: true, cursorValue: cursor })}
        >
          Load more
        </Button>
      )}

      {loading && items.length > 0 && (
        <div className="flex justify-center py-2">
          <Loader2 className="size-4 animate-spin text-orange-500" />
        </div>
      )}
    </div>
  );
}

export default BrokerActivityView;
