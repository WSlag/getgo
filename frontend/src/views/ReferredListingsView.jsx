import { useEffect, useMemo, useState } from 'react';
import { Clock3, ExternalLink, Loader2, X, FileText } from 'lucide-react';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { cn } from '@/lib/utils';
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

function statusLabel(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'closed_listing') return 'Closed';
  if (!normalized) return 'Pending';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'pending' || normalized === 'opened') return 'warning';
  if (normalized === 'acted') return 'success';
  if (normalized === 'dismissed' || normalized === 'closed_listing') return 'secondary';
  return 'destructive';
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

  const filterChipBase = 'inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const filterChipActive = 'gradient-primary text-primary-foreground shadow-glow-orange';
  const filterChipInactive = 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground';

  const loadReferrals = async ({ append = false, cursorValue = null } = {}) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.referrals.getMyListingReferrals({
        statusFilter,
        limit: 20,
        cursor: cursorValue,
      });
      setItems((prev) => (
        append
          ? dedupeAndSortNewest(prev, response?.items || [])
          : dedupeAndSortNewest([], response?.items || [])
      ));
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
    } catch {
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
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-6">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={cn(
                filterChipBase,
                statusFilter === filter.id ? filterChipActive : filterChipInactive
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
          <div className="flex items-center justify-center gap-2 text-sm font-normal text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-primary" />
            Loading referred listings...
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:p-6">
          <EmptyState
            icon={FileText}
            title="No referred listings"
            description="Listings you refer will appear here. Share cargo or truck listings to earn referral commissions."
          />
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
                className="rounded-2xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {item.listingType === 'truck' ? 'Truck Listing' : 'Cargo Listing'}
                    </p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {(item.route?.origin || 'Origin')} {' -> '} {(item.route?.destination || 'Destination')}
                    </p>
                    <p className="mt-1 text-xs font-normal text-muted-foreground">
                      Broker: {item.brokerMasked || 'Broker'}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(item.status)}>
                    {statusLabel(item.status)}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs font-normal text-muted-foreground">
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

                <div className="mt-3 flex flex-col gap-2 lg:flex-row">
                  <Button
                    variant="gradient"
                    className="w-full gap-2 lg:flex-1"
                    onClick={() => handleOpenListing(item)}
                    disabled={updatingId === item.id}
                  >
                    {updatingId === item.id ? <Loader2 className="size-4 animate-spin" /> : <ExternalLink className="size-4" />}
                    View Listing
                  </Button>
                  {(item.status === 'pending' || item.status === 'opened') && (
                    <Button
                      variant="outline"
                      className="w-full gap-2 lg:w-auto"
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
