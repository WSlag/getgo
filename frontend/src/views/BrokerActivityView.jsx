import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
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
  return dateValue.toLocaleString();
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
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {typeFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setTypeFilter(filter.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              typeFilter === filter.id
                ? 'bg-orange-500 text-white'
                : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {statusFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setStatusFilter(filter.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === filter.id
                ? 'bg-orange-500 text-white'
                : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={handleBackfill} disabled={backfilling}>
          {backfilling ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Backfill History
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{summary.total || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <p className="text-xs text-gray-500">Cargo Bids</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{summary?.byType?.cargo_bids || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <p className="text-xs text-gray-500">Truck Bookings</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{summary?.byType?.truck_bookings || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <p className="text-xs text-gray-500">Contracts</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{summary?.byType?.contracts || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-2">
            <p className="text-xs text-gray-500">Completed</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{summary?.byStatus?.completed || 0}</p>
          </div>
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="py-10 flex items-center justify-center text-gray-500">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading broker activity...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 p-3 text-sm">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No broker activity yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{typeLabel(item.activityType)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {item.origin || 'Origin'} {' -> '} {item.destination || 'Destination'}
                  </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(item.status)}`}>
                  {String(item.status || 'pending')}
                </span>
              </div>

              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-4">
                <span>Referred: {item.referredUserMasked || 'User'}</span>
                <span>Counterparty: {item.counterpartyMasked || 'Counterparty'}</span>
                {item.amount ? <span>Amount: PHP {Number(item.amount).toLocaleString()}</span> : null}
                <span>{formatDate(item.activityAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={() => loadActivity({ append: true, cursorValue: cursor })}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default BrokerActivityView;
