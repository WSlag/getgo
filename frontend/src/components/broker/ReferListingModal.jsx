import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import api from '@/services/api';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

function formatRoute(listing) {
  const origin = listing?.origin || 'Origin';
  const destination = listing?.destination || 'Destination';
  return `${origin} -> ${destination}`;
}

export function ReferListingModal({
  open,
  onClose,
  listing = null,
  listingType = 'cargo',
  onToast,
  onSuccess,
}) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isMobile = useMediaQuery('(max-width: 1023px)');

  const isValid = useMemo(() => Boolean(listing?.id && selectedIds.length > 0), [listing?.id, selectedIds.length]);

  const loadUsers = async () => {
    if (!open) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.broker.getReferredUsers({
        limit: 50,
        query,
      });
      setUsers(response?.items || []);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load referred users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setQuery('');
      setUsers([]);
      setSelectedIds([]);
      setNote('');
      setError('');
      return;
    }
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      loadUsers();
    }, 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const toggleSelect = (referredUserId) => {
    setSelectedIds((prev) => (
      prev.includes(referredUserId)
        ? prev.filter((id) => id !== referredUserId)
        : [...prev, referredUserId]
    ));
  };

  const handleSubmit = async () => {
    if (!isValid || !listing?.id) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await api.broker.referListing({
        listingId: listing.id,
        listingType,
        referredUserIds: selectedIds,
        note: note.trim() || null,
      });
      onToast?.({
        type: 'success',
        title: 'Listing Referred',
        message: `Created: ${response?.createdCount || 0}, Resent: ${response?.resentCount || 0}, Skipped: ${response?.skippedCount || 0}`,
      });
      onSuccess?.(response);
      onClose?.();
    } catch (submitError) {
      setError(submitError.message || 'Failed to send referral');
      onToast?.({
        type: 'error',
        title: 'Referral failed',
        message: submitError.message || 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogBottomSheet className="max-w-xl backdrop-blur-sm" hideCloseButton>
        <div style={{ padding: isMobile ? '16px' : '24px', paddingBottom: 0 }}>
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/30 flex items-center justify-center flex-shrink-0">
                <Send className="size-5 text-white" />
              </div>
              <div className="min-w-0">
                <DialogTitle>Refer Listing</DialogTitle>
                <DialogDescription className="mt-1">
                  Refer this {listingType} listing to your attributed users.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-4 space-y-4 pb-4">
            <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">Listing</p>
              <p className="text-sm font-medium text-foreground mt-1">{formatRoute(listing)}</p>
            </div>

            <div>
              <label className="block text-sm text-foreground mb-2">
                Find referred users
              </label>
              <div className="relative">
                <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search referred user"
                  className="pl-10"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card max-h-56 overflow-y-auto">
              {loading ? (
                <div className="py-8 flex items-center justify-center text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No referred users found.
                </div>
              ) : (
                users.map((user) => {
                  const checked = selectedIds.includes(user.referredUserId);
                  return (
                    <button
                      key={user.referredUserId}
                      type="button"
                      onClick={() => toggleSelect(user.referredUserId)}
                      className={cn(
                        'w-full px-4 py-3 text-left border-b border-border last:border-b-0 transition-colors',
                        checked
                          ? 'bg-orange-50 dark:bg-orange-900/20'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{user.maskedDisplay}</p>
                          <p className="text-xs text-muted-foreground">{user.referredRole || 'user'}</p>
                        </div>
                        <span
                          className={cn(
                            'size-5 rounded-md border flex items-center justify-center transition-colors flex-shrink-0',
                            checked
                              ? 'bg-orange-500 border-orange-500 text-white'
                              : 'border-border text-transparent'
                          )}
                        >
                          <Check className="size-3.5" />
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div>
              <label className="block text-sm text-foreground mb-2">
                Note (optional)
              </label>
              <Textarea
                value={note}
                onChange={(event) => setNote(event.target.value.slice(0, 200))}
                rows={3}
                placeholder="Add a short note for referred users"
                className="min-h-[88px]"
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {selectedIds.length > 0 ? `${selectedIds.length} user${selectedIds.length > 1 ? 's' : ''} selected` : 'No users selected'}
                </p>
                <p className="text-xs text-muted-foreground">{note.length}/200</p>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </div>

        <div
          className="dialog-fixed-footer flex-shrink-0 border-t border-border bg-background flex gap-3"
          style={{ padding: isMobile ? '16px' : '20px' }}
        >
          <Button variant="ghost" onClick={onClose} className="flex-1" disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="flex-1 gap-2"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Send Referral
          </Button>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default ReferListingModal;
