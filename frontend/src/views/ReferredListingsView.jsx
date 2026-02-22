import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, ExternalLink, Loader2, X } from 'lucide-react';
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

function statusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'closed_listing') return 'Closed';
  return normalized ? normalized.replace(/_/g, ' ') : 'pending';
}

function statusClass(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending' || normalized === 'opened') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  if (normalized === 'acted') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
  if (normalized === 'dismissed' || normalized === 'closed_listing') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

export function ReferredListingsView({
  onOpenListing,
  onToast,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const loadReferrals = async ({ append = false, cursorValue = null } = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.referrals.getMyListingReferrals({
        statusFilter,
        limit: 20,
        cursor: cursorValue,
      });
      setItems((prev) => (append ? [...prev, ...(response?.items || [])] : (response?.items || [])));
      setCursor(response?.nextCursor || null);
      setHasMore(Boolean(response?.hasMore));
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load referred listings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReferrals({ append: false, cursorValue: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filters = useMemo(() => ([
    { id: 'active', label: 'Active' },
    { id: 'all', label: 'All' },
    { id: 'acted', label: 'Acted' },
    { id: 'expired', label: 'Expired' },
    { id: 'closed', label: 'Closed' },
  ]), []);

  const handleOpenListing = async (item) => {
    setUpdatingId(item.id);
    try {
      await api.referrals.updateMyListingReferralState({
        referralId: item.id,
        action: 'opened',
      });
    } catch (errorOpen) {
      // Non-blocking; user should still be able to open the listing.
    } finally {
      setUpdatingId(null);
    }
    onOpenListing?.(item);
  };

  const handleDismiss = async (item) => {
    setUpdatingId(item.id);
    try {
      const response = await api.referrals.updateMyListingReferralState({
        referralId: item.id,
        action: 'dismissed',
      });
      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, status: response?.status || 'dismissed' } : row)));
      onToast?.({
        type: 'info',
        title: 'Referral dismissed',
        message: 'This listing referral was dismissed.',
      });
    } catch (dismissError) {
      onToast?.({
        type: 'error',
        title: 'Dismiss failed',
        message: dismissError.message || 'Please try again.',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {filters.map((filter) => (
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

      {loading && items.length === 0 ? (
        <div className="py-10 flex items-center justify-center text-gray-500">
          <Loader2 className="size-4 animate-spin mr-2" />
          Loading referred listings...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 p-3 text-sm">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No referred listings found.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const expiresAt = toDate(item.expiresAt);
            const remainingMs = expiresAt ? (expiresAt.getTime() - Date.now()) : null;
            const remainingHours = remainingMs !== null ? Math.max(0, Math.ceil(remainingMs / (60 * 60 * 1000))) : null;

            return (
              <div
                key={item.id}
                className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.listingType === 'truck' ? 'Truck Listing' : 'Cargo Listing'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(item.route?.origin || 'Origin')} {' -> '} {(item.route?.destination || 'Destination')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Broker: {item.brokerMasked || 'Broker'}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClass(item.status)}`}>
                    {statusLabel(item.status)}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    <Clock3 className="size-3.5" />
                    Sent: {formatDate(item.createdAt)}
                  </span>
                  {remainingHours !== null && (
                    <span>Expires in {remainingHours}h</span>
                  )}
                  {item.askingPrice ? (
                    <span>Price: PHP {Number(item.askingPrice).toLocaleString()}</span>
                  ) : null}
                </div>

                <div className="mt-3 flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 gap-2"
                    onClick={() => handleOpenListing(item)}
                    disabled={updatingId === item.id}
                  >
                    {updatingId === item.id ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                    View Listing
                  </Button>
                  {(item.status === 'pending' || item.status === 'opened') && (
                    <Button
                      variant="ghost"
                      className="gap-2"
                      onClick={() => handleDismiss(item)}
                      disabled={updatingId === item.id}
                    >
                      <X className="size-4" />
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && !loading && (
        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={() => loadReferrals({ append: true, cursorValue: cursor })}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

export default ReferredListingsView;
