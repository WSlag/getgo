import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Send } from 'lucide-react';
import api from '@/services/api';
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
      <DialogBottomSheet className="max-w-xl" hideCloseButton>
        <div className="p-4 lg:p-6">
          <DialogHeader>
            <DialogTitle>Refer Listing</DialogTitle>
            <DialogDescription>
              Refer this {listingType} listing to your attributed users.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Listing</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">{formatRoute(listing)}</p>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Find referred users
            </label>
            <div className="relative">
              <Search className="size-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search referred user"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-9 pr-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 max-h-56 overflow-y-auto">
            {loading ? (
              <div className="py-8 flex items-center justify-center text-gray-500">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">No referred users found.</div>
            ) : (
              users.map((user) => {
                const checked = selectedIds.includes(user.referredUserId);
                return (
                  <button
                    key={user.referredUserId}
                    type="button"
                    onClick={() => toggleSelect(user.referredUserId)}
                    className={`w-full px-3 py-2 text-left border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition-colors ${
                      checked ? 'bg-orange-50 dark:bg-orange-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.maskedDisplay}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{user.referredRole || 'user'}</p>
                      </div>
                      <input readOnly type="checkbox" checked={checked} className="size-4 accent-orange-500" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, 200))}
              rows={3}
              placeholder="Add a short note for referred users"
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">{note.length}/200</p>
          </div>

          {error && (
            <div className="mt-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || submitting} className="flex-1 gap-2">
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Send Referral
            </Button>
          </div>
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

export default ReferListingModal;
