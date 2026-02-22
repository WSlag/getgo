import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Link2,
  Wallet,
  TrendingUp,
  Clock3,
  Copy,
  CheckCircle2,
  ArrowUpRight,
  Loader2,
} from 'lucide-react';
import api from '@/services/api';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';

const MIN_PAYOUT = 500;

function toDate(value) {
  if (!value) return null;
  if (value.toDate && typeof value.toDate === 'function') return value.toDate();
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime(value) {
  const d = toDate(value);
  if (!d) return '-';
  return d.toLocaleString();
}

function currency(value) {
  return `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatReferralStatus(value) {
  const normalized = String(value || '').toLowerCase();
  if (!normalized) return 'Pending';
  return normalized.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function BrokerView({
  authUser,
  isBroker = false,
  brokerProfile = null,
  onOpenBrokerActivity,
  onBrokerRegistered,
  onToast,
}) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('gcash');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [payoutFilter, setPayoutFilter] = useState('all');
  const [referralItems, setReferralItems] = useState([]);
  const [referralSummary, setReferralSummary] = useState(null);
  const [referralCursor, setReferralCursor] = useState(null);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralsHasMore, setReferralsHasMore] = useState(false);

  const fetchDashboard = async () => {
    if (!authUser || !isBroker) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.broker.getDashboard();
      setDashboard(data);
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load broker dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchListingReferrals = async ({ append = false, cursorValue = null } = {}) => {
    if (!authUser || !isBroker) return;
    setReferralsLoading(true);
    try {
      const data = await api.broker.getListingReferrals({
        limit: 10,
        cursor: cursorValue,
        statusFilter: 'all',
        listingTypeFilter: 'all',
      });
      setReferralItems((prev) => (append ? [...prev, ...(data?.items || [])] : (data?.items || [])));
      setReferralSummary(data?.summary || null);
      setReferralCursor(data?.nextCursor || null);
      setReferralsHasMore(Boolean(data?.hasMore));
    } catch (fetchError) {
      onToast?.({
        type: 'error',
        title: 'Listing referrals',
        message: fetchError.message || 'Failed to load listing referral activity.',
      });
    } finally {
      setReferralsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchListingReferrals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.uid, isBroker]);

  const broker = dashboard?.broker || brokerProfile || null;
  const referralCode = broker?.referralCode || '';
  const referralLink = referralCode
    ? `${window.location.origin}/r/${referralCode}`
    : '';
  const availableBalance = Number(broker?.availableBalance || 0);

  const commissions = useMemo(
    () => (dashboard?.commissions || []),
    [dashboard?.commissions]
  );

  const payouts = useMemo(() => {
    const list = dashboard?.payouts || [];
    if (payoutFilter === 'all') return list;
    return list.filter((item) => item.status === payoutFilter);
  }, [dashboard?.payouts, payoutFilter]);

  const handleRegister = async () => {
    setRegistering(true);
    setError('');
    try {
      await api.broker.register();
      onBrokerRegistered?.();
      onToast?.({
        type: 'success',
        title: 'Broker Activated',
        message: 'Your broker profile is now active.',
      });
      await fetchDashboard();
      await fetchListingReferrals();
    } catch (registerError) {
      setError(registerError.message || 'Failed to register as broker');
    } finally {
      setRegistering(false);
    }
  };

  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      onToast?.({
        type: 'success',
        title: 'Copied',
        message: 'Referral link copied to clipboard.',
      });
    } catch (copyError) {
      onToast?.({
        type: 'error',
        title: 'Copy Failed',
        message: 'Could not copy referral link.',
      });
    }
  };

  const handleRequestPayout = async () => {
    const amount = Number(payoutAmount);
    if (!Number.isFinite(amount) || amount < MIN_PAYOUT) {
      setError(`Minimum payout is ${currency(MIN_PAYOUT)}`);
      return;
    }
    if (amount > availableBalance) {
      setError('Payout amount exceeds available balance');
      return;
    }

    setSubmittingPayout(true);
    setError('');
    try {
      await api.broker.requestPayout({
        amount,
        method: payoutMethod,
        payoutDetails: {
          accountName: accountName.trim() || null,
          accountNumber: accountNumber.trim() || null,
        },
      });

      setPayoutAmount('');
      setAccountName('');
      setAccountNumber('');
      onToast?.({
        type: 'success',
        title: 'Payout Requested',
        message: 'Your payout request is pending admin approval.',
      });
      await fetchDashboard();
      await fetchListingReferrals();
    } catch (payoutError) {
      setError(payoutError.message || 'Failed to submit payout request');
    } finally {
      setSubmittingPayout(false);
    }
  };

  const commissionColumns = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (_, row) => formatDateTime(row.createdAt),
    },
    {
      key: 'platformFeeAmount',
      header: 'Platform Fee',
      render: (value) => <span className="font-medium">{currency(value)}</span>,
    },
    {
      key: 'commissionRate',
      header: 'Rate',
      render: (value) => `${Number(value || 0)}%`,
    },
    {
      key: 'commissionAmount',
      header: 'Commission',
      render: (value) => <span className="font-semibold text-green-600 dark:text-green-400">{currency(value)}</span>,
    },
  ];

  const payoutColumns = [
    {
      key: 'createdAt',
      header: 'Requested',
      render: (_, row) => formatDateTime(row.createdAt || row.requestedAt),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (value) => <span className="font-medium">{currency(value)}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (value) => String(value || '-').toUpperCase(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (value) => {
        const status = String(value || '').toLowerCase();
        const cls =
          status === 'approved'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : status === 'rejected'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
            {status || 'pending'}
          </span>
        );
      },
    },
  ];

  const getPayoutStatusClass = (value) => {
    const status = String(value || '').toLowerCase();
    if (status === 'approved') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    if (status === 'rejected') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
  };

  if (!authUser) {
    return (
      <main
        className="flex-1 overflow-y-auto p-4 lg:p-8"
        style={{ paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : undefined }}
      >
        <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-4">Broker Program</h2>
        <p className="text-gray-600 dark:text-gray-400">Sign in to access broker dashboard and payouts.</p>
      </main>
    );
  }

  if (!isBroker) {
    return (
      <main
        className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto"
        style={{ padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px' }}
      >
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm" style={{ padding: isMobile ? '16px' : '20px' }}>
          <div className="flex items-center" style={{ gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '12px' : '16px' }}>
            <div className="size-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-green-500/30">
              <Users className="size-6" />
            </div>
            <div>
              <h2 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: 'bold' }} className="text-gray-900 dark:text-white">Broker Program</h2>
              <p style={{ fontSize: isMobile ? '12px' : '14px' }} className="text-gray-500 dark:text-gray-400">Earn from referred completed platform-fee transactions.</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3" style={{ gap: isMobile ? '10px' : '12px', marginBottom: isMobile ? '16px' : '20px' }}>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '12px' : '14px' }}>
              <p className="text-xs text-gray-500 dark:text-gray-400">Commission Base</p>
              <p className="font-semibold text-gray-900 dark:text-white">Platform Fee</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '12px' : '14px' }}>
              <p className="text-xs text-gray-500 dark:text-gray-400">Commission Tiers</p>
              <p className="font-semibold text-gray-900 dark:text-white">3% to 6%</p>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '12px' : '14px' }}>
              <p className="text-xs text-gray-500 dark:text-gray-400">Payout Policy</p>
              <p className="font-semibold text-gray-900 dark:text-white">Admin Approved</p>
            </div>
          </div>
          <Button
            onClick={handleRegister}
            disabled={registering}
            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white"
          >
            {registering ? 'Activating...' : 'Become a Broker'}
          </Button>
          {error && <p className="text-sm text-red-600 dark:text-red-400" style={{ marginTop: isMobile ? '10px' : '12px' }}>{error}</p>}
        </div>
      </main>
    );
  }

  return (
    <main
      className="flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto"
      style={{ padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px' }}
    >
      <div className="mx-auto w-full max-w-5xl" style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? '16px' : '24px' }}>
        {/* Header */}
        <div style={{ marginBottom: isMobile ? '8px' : '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div className="size-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
              <Users className="size-6 text-white" />
            </div>
            <div>
              <h1 style={{
                fontWeight: 'bold',
                color: 'var(--text-primary)',
                fontSize: isMobile ? '20px' : '24px',
                marginBottom: '4px',
                lineHeight: '1.2'
              }}>Broker Dashboard</h1>
              <p style={{
                color: '#6b7280',
                fontSize: isMobile ? '12px' : '14px'
              }}>
                Track referrals, commissions, and payout requests.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 text-sm" style={{ padding: isMobile ? '12px 16px' : '14px 20px' }}>
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isMobile ? '12px' : '16px' }}>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '14px' : '16px' }}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Available Balance</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">{currency(broker?.availableBalance)}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '14px' : '16px' }}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending Earnings</p>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{currency(broker?.pendingEarnings)}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '14px' : '16px' }}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Earnings</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{currency(broker?.totalEarnings)}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '14px' : '16px' }}>
            <p className="text-xs text-gray-500 dark:text-gray-400">Active Referrals</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{Number(broker?.totalReferrals || 0)}</p>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '16px' : '20px' }}>
          <div className="flex items-center justify-between gap-3" style={{ marginBottom: isMobile ? '12px' : '14px' }}>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Listing Referral Activity</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Broker-referred cargo and truck posts summary</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => onOpenBrokerActivity?.()}>
              Open Broker Activity
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5" style={{ gap: isMobile ? '8px' : '12px', marginBottom: isMobile ? '12px' : '14px' }}>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sent (24h)</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{Number(referralSummary?.sent24h || 0)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Sent (7d)</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{Number(referralSummary?.sent7d || 0)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Opened</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{Number(referralSummary?.opened || 0)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Acted</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{Number(referralSummary?.acted || 0)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Expired</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{Number(referralSummary?.expired || 0)}</p>
            </div>
          </div>

          {referralsLoading && referralItems.length === 0 ? (
            <div className="py-6 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
              <Loader2 className="size-4 animate-spin mr-2" />
              Loading referral operations...
            </div>
          ) : referralItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No listing referrals sent yet.
            </div>
          ) : (
            <div className="space-y-2">
              {referralItems.map((item) => (
                <div key={item.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {String(item.listingType || 'listing').toUpperCase()} {item.route?.origin || 'Origin'} {' -> '} {item.route?.destination || 'Destination'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Referred user: {item.referredUserMasked || 'User'} {item.askingPrice ? `| ${currency(item.askingPrice)}` : ''}
                      </p>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {formatReferralStatus(item.status)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Updated {formatDateTime(item.updatedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {referralsHasMore && (
            <Button
              variant="outline"
              className="w-full mt-3"
              onClick={() => fetchListingReferrals({ append: true, cursorValue: referralCursor })}
              disabled={referralsLoading}
            >
              {referralsLoading ? 'Loading...' : 'Load More'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: isMobile ? '12px' : '16px' }}>
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: isMobile ? '12px' : '16px' }}>
            <div className="flex items-center gap-2">
              <Link2 className="size-4 text-orange-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Referral Link</h3>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Referral Code</p>
              <p className="font-mono font-semibold text-gray-900 dark:text-white break-all">{referralCode || '-'}</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 break-all">
              <p className="text-xs text-gray-500 dark:text-gray-400">Share Link</p>
              <p className="text-sm text-gray-900 dark:text-white">{referralLink || '-'}</p>
            </div>
            <div className={isMobile ? "grid grid-cols-2 gap-2" : "flex gap-2"}>
              <Button variant="outline" className="w-full" onClick={handleCopyLink} disabled={!referralLink}>
                <Copy className="size-4 mr-2" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => referralLink && window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank')}
                disabled={!referralLink}
              >
                <ArrowUpRight className="size-4 mr-2" />
                Share
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '16px' : '20px', display: 'flex', flexDirection: 'column', gap: isMobile ? '10px' : '12px' }}>
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-green-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Request Payout</h3>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                <input
                  type="number"
                  min={MIN_PAYOUT}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  placeholder={`Amount (min ${MIN_PAYOUT})`}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Method</p>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                >
                  <option value="gcash">GCash</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Account Name</p>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Account Name"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400">Account Number</p>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account Number"
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Minimum payout: {currency(MIN_PAYOUT)}. Requests are released after admin approval.
            </p>
            <Button
              onClick={handleRequestPayout}
              disabled={submittingPayout || loading}
              className="w-full bg-gradient-to-r from-orange-400 to-orange-600 text-white"
            >
              {submittingPayout ? 'Submitting...' : 'Submit Payout Request'}
            </Button>
          </div>
        </div>

        {isMobile ? (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-orange-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Commissions</h3>
            </div>
            {loading ? (
              <div className="py-6 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading commissions...
              </div>
            ) : commissions.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No commissions yet
              </div>
            ) : (
              <div className="space-y-2">
                {commissions.map((row) => (
                  <div key={row.id || `${row.createdAt}-${row.commissionAmount}`} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(row.createdAt)}</p>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-600 dark:text-gray-400">Platform Fee</p>
                      <p className="text-right font-medium text-gray-900 dark:text-white">{currency(row.platformFeeAmount)}</p>
                      <p className="text-gray-600 dark:text-gray-400">Rate</p>
                      <p className="text-right font-medium text-gray-900 dark:text-white">{Number(row.commissionRate || 0)}%</p>
                      <p className="text-gray-600 dark:text-gray-400">Commission</p>
                      <p className="text-right font-semibold text-green-600 dark:text-green-400">{currency(row.commissionAmount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <DataTable
            columns={commissionColumns}
            data={commissions}
            loading={loading}
            emptyMessage="No commissions yet"
            emptyIcon={TrendingUp}
          />
        )}

        {isMobile ? (
          <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="flex items-center gap-2">
              <Clock3 className="size-4 text-orange-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Payout Requests</h3>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterButton active={payoutFilter === 'all'} onClick={() => setPayoutFilter('all')} className="px-3 py-1.5 text-xs">All</FilterButton>
              <FilterButton active={payoutFilter === 'pending'} onClick={() => setPayoutFilter('pending')} className="px-3 py-1.5 text-xs">Pending</FilterButton>
              <FilterButton active={payoutFilter === 'approved'} onClick={() => setPayoutFilter('approved')} className="px-3 py-1.5 text-xs">Approved</FilterButton>
              <FilterButton active={payoutFilter === 'rejected'} onClick={() => setPayoutFilter('rejected')} className="px-3 py-1.5 text-xs">Rejected</FilterButton>
            </div>
            {loading ? (
              <div className="py-6 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                <Loader2 className="size-4 animate-spin mr-2" />
                Loading payout requests...
              </div>
            ) : payouts.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                No payout requests yet
              </div>
            ) : (
              <div className="space-y-2">
                {payouts.map((row) => (
                  <div key={row.id || `${row.createdAt}-${row.amount}`} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(row.createdAt || row.requestedAt)}</p>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPayoutStatusClass(row.status)}`}>
                        {String(row.status || 'pending')}
                      </span>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
                      <p className="text-gray-600 dark:text-gray-400">Amount</p>
                      <p className="text-right font-medium text-gray-900 dark:text-white">{currency(row.amount)}</p>
                      <p className="text-gray-600 dark:text-gray-400">Method</p>
                      <p className="text-right font-medium text-gray-900 dark:text-white">{String(row.method || '-').toUpperCase()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <DataTable
            columns={payoutColumns}
            data={payouts}
            loading={loading}
            emptyMessage="No payout requests yet"
            emptyIcon={Clock3}
            filters={(
              <>
                <FilterButton active={payoutFilter === 'all'} onClick={() => setPayoutFilter('all')}>All</FilterButton>
                <FilterButton active={payoutFilter === 'pending'} onClick={() => setPayoutFilter('pending')}>Pending</FilterButton>
                <FilterButton active={payoutFilter === 'approved'} onClick={() => setPayoutFilter('approved')}>Approved</FilterButton>
                <FilterButton active={payoutFilter === 'rejected'} onClick={() => setPayoutFilter('rejected')}>Rejected</FilterButton>
              </>
            )}
          />
        )}

        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700" style={{ padding: isMobile ? '16px' : '20px' }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-green-500" />
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Broker capability is active on your {broker?.sourceRole || 'account'} profile. You can keep operating as shipper/trucker while earning as broker.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default BrokerView;
