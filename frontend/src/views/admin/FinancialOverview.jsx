import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  CreditCard,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from 'lucide-react';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, collectionGroup, documentId, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '@/firebase';
import api from '@/services/api';

// Transaction type badge
function TransactionTypeBadge({ type }) {
  const config = {
    topup: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: ArrowUpRight },
    fee: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: PesoIcon },
    payout: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', icon: ArrowDownRight },
    refund: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: ArrowUpRight },
  };

  const { bg, text, icon: Icon } = config[type] || config.topup;
  const label = type?.charAt(0).toUpperCase() + type?.slice(1) || 'Transaction';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

export function FinancialOverview() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    todayRevenue: 0,
    weekRevenue: 0,
    monthRevenue: 0,
    totalWalletBalance: 0,
    pendingPayouts: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Fetch financial data
  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      // Align revenue windows with backend Manila day boundaries.
      const now = new Date();
      const utcMs = now.getTime() + (now.getTimezoneOffset() * 60000);
      const manilaMs = utcMs + (8 * 60 * 60 * 1000);
      const manilaDate = new Date(manilaMs);
      manilaDate.setHours(0, 0, 0, 0);
      const today = new Date(manilaDate.getTime() - (8 * 60 * 60 * 1000));
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [paymentStatsResult, dashboardStatsResult] = await Promise.allSettled([
        api.admin.getPaymentStats(),
        api.admin.getDashboardStats(),
      ]);
      const paymentStats = paymentStatsResult.status === 'fulfilled' ? paymentStatsResult.value : null;
      const dashboardStats = dashboardStatsResult.status === 'fulfilled' ? dashboardStatsResult.value : null;

      // Keep "Today's Revenue" aligned with Payment Review stats when available.
      const fallbackTodayRevenue = Number(paymentStats?.totalAmountToday || paymentStats?.stats?.totalAmountToday || 0);
      const fallbackTotalRevenue = Number(dashboardStats?.financial?.platformFeesCollected || 0);
      const fallbackWalletBalance = Number(dashboardStats?.financial?.totalWalletBalance || 0);

      let totalRevenue = fallbackTotalRevenue;
      let todayRevenue = fallbackTodayRevenue;
      let weekRevenue = 0;
      let monthRevenue = 0;
      const txData = [];

      try {
        // Authoritative fee ledger for platform revenue history.
        const platformFeesSnapshot = await getDocs(
          query(
            collection(db, 'platformFees'),
            where('status', '==', 'completed'),
            orderBy('createdAt', 'desc')
          )
        );

        let computedTotalRevenue = 0;
        let computedTodayRevenue = 0;
        let computedWeekRevenue = 0;
        let computedMonthRevenue = 0;

        platformFeesSnapshot.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const feeAmount = Number(data.amount || 0);
          if (!Number.isFinite(feeAmount) || feeAmount <= 0) return;

          computedTotalRevenue += feeAmount;

          const collectedAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
          if (collectedAt && !Number.isNaN(collectedAt.getTime())) {
            if (collectedAt >= today) computedTodayRevenue += feeAmount;
            if (collectedAt >= weekAgo) computedWeekRevenue += feeAmount;
            if (collectedAt >= monthAgo) computedMonthRevenue += feeAmount;
          }

          txData.push({
            id: docSnap.id,
            type: 'fee',
            amount: feeAmount,
            userId: data.userId || '',
            userName: data.userName || data.userId?.slice(0, 12) || 'Unknown',
            createdAt: collectedAt || new Date(),
          });
        });

        totalRevenue = computedTotalRevenue;
        weekRevenue = computedWeekRevenue;
        monthRevenue = computedMonthRevenue;

        // Prefer backend payment-stats value to stay consistent with Payment Review.
        todayRevenue = fallbackTodayRevenue > 0 ? fallbackTodayRevenue : computedTodayRevenue;
      } catch (platformFeeError) {
        console.warn('Platform fee query blocked; using callable stat fallbacks:', platformFeeError);
      }

      let totalWalletBalance = fallbackWalletBalance;
      try {
        // Aggregate wallet balances without N+1 user queries
        const walletsSnapshot = await getDocs(query(collectionGroup(db, 'wallet')));
        totalWalletBalance = 0;
        walletsSnapshot.forEach((walletDoc) => {
          totalWalletBalance += Number(walletDoc.data()?.balance || 0);
        });
      } catch (walletError) {
        // Keep fallback value from adminGetDashboardStats.
        console.warn('Wallet balance query blocked, using admin summary fallback:', walletError);
      }

      setStats({
        totalRevenue,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalWalletBalance,
        pendingPayouts: 0, // Payout request tracking not yet implemented
      });

      const recentTx = txData.slice(0, 20);
      const userIds = [...new Set(recentTx.map((tx) => tx.userId).filter(Boolean))];
      const userNameById = {};

      // Firestore "in" accepts up to 10 values, so chunk user lookups.
      if (userIds.length > 0) {
        try {
          const chunks = [];
          for (let i = 0; i < userIds.length; i += 10) {
            chunks.push(userIds.slice(i, i + 10));
          }

          const snapshots = await Promise.all(
            chunks.map((ids) =>
              getDocs(
                query(
                  collection(db, 'users'),
                  where(documentId(), 'in', ids)
                )
              )
            )
          );

          snapshots.forEach((snapshot) => {
            snapshot.forEach((userDoc) => {
              const userData = userDoc.data() || {};
              userNameById[userDoc.id] =
                userData.displayName ||
                userData.name ||
                userData.email ||
                userDoc.id.slice(0, 12);
            });
          });
        } catch (userLookupError) {
          console.warn('User name lookup blocked; using UID fallback labels:', userLookupError);
        }
      }

      setTransactions(
        recentTx.map((tx) => ({
          ...tx,
          userName: userNameById[tx.userId] || tx.userName,
        }))
      );
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, []);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (!searchQuery) return true;
    const lowered = searchQuery.toLowerCase();
    return tx.userName?.toLowerCase().includes(lowered) || tx.userId?.toLowerCase().includes(lowered);
  });

  // Table columns
  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (_, row) => <TransactionTypeBadge type={row.type} />,
    },
    {
      key: 'user',
      header: 'User',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.userName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{row.userId?.slice(0, 12)}...</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (_, row) => {
        const isOutflow = row.type === 'payout' || row.type === 'refund';
        return (
          <span className={cn('font-semibold', isOutflow ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
            {isOutflow ? '-' : '+'}₱{formatPrice(row.amount)}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (_, row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(row.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Today's Revenue"
          value={`₱${formatPrice(stats.todayRevenue)}`}
          icon={PesoIcon}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="This Week"
          value={`₱${formatPrice(stats.weekRevenue)}`}
          icon={TrendingUp}
          iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="This Month"
          value={`₱${formatPrice(stats.monthRevenue)}`}
          icon={Calendar}
          iconColor="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="All Time"
          value={`₱${formatPrice(stats.totalRevenue)}`}
          icon={PesoIcon}
          iconColor="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Wallet Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Total Wallet Balances"
          value={`₱${formatPrice(stats.totalWalletBalance)}`}
          subtitle="Combined balance of all users"
          icon={Wallet}
          iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Pending Payouts"
          value={`₱${formatPrice(stats.pendingPayouts)}`}
          subtitle="Awaiting processing"
          icon={CreditCard}
          iconColor="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
        />
      </div>

      {/* Recent Transactions */}
      <DataTable
        columns={columns}
        data={filteredTransactions}
        loading={loading}
        emptyMessage="No transactions found"
        emptyIcon={PesoIcon}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by user name or ID..."
        filters={
          <>
            <FilterButton active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
              All
            </FilterButton>
            <FilterButton active={typeFilter === 'topup'} onClick={() => setTypeFilter('topup')}>
              Top-ups
            </FilterButton>
            <FilterButton active={typeFilter === 'fee'} onClick={() => setTypeFilter('fee')}>
              Fees
            </FilterButton>
            <FilterButton active={typeFilter === 'payout'} onClick={() => setTypeFilter('payout')}>
              Payouts
            </FilterButton>
            <FilterButton active={typeFilter === 'refund'} onClick={() => setTypeFilter('refund')}>
              Refunds
            </FilterButton>
          </>
        }
      />
    </div>
  );
}

export default FinancialOverview;
