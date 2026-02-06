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
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
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
      // Fetch payment stats
      const paymentStats = await api.admin.getPaymentStats();

      // Calculate revenue from approved payments
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch payment submissions for revenue calculation
      const paymentsSnapshot = await getDocs(
        query(
          collection(db, 'paymentSubmissions'),
          where('status', '==', 'approved'),
          orderBy('resolvedAt', 'desc')
        )
      );

      let totalRevenue = 0;
      let todayRevenue = 0;
      let weekRevenue = 0;
      let monthRevenue = 0;

      paymentsSnapshot.forEach(doc => {
        const data = doc.data();
        const amount = data.orderAmount || 0;
        const platformFee = amount * 0.05; // 5% platform fee
        totalRevenue += platformFee;

        const resolvedAt = data.resolvedAt?.toDate?.() || new Date(data.resolvedAt);
        if (resolvedAt >= today) todayRevenue += platformFee;
        if (resolvedAt >= weekAgo) weekRevenue += platformFee;
        if (resolvedAt >= monthAgo) monthRevenue += platformFee;
      });

      // Fetch wallet balances
      const usersSnapshot = await getDocs(collection(db, 'users'));
      let totalWalletBalance = 0;

      for (const userDoc of usersSnapshot.docs) {
        const walletDoc = await getDocs(collection(db, 'users', userDoc.id, 'wallet'));
        walletDoc.forEach(w => {
          totalWalletBalance += w.data().balance || 0;
        });
      }

      setStats({
        totalRevenue,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        totalWalletBalance,
        pendingPayouts: 0, // TODO: Calculate from pending payout requests
      });

      // Fetch recent transactions (mock for now)
      // In production, this would come from a walletTransactions collection
      const mockTransactions = [
        { id: '1', type: 'topup', amount: 5000, userId: 'user1', userName: 'Juan Cruz', createdAt: new Date() },
        { id: '2', type: 'fee', amount: 250, userId: 'user2', userName: 'Maria Santos', createdAt: new Date(Date.now() - 3600000) },
        { id: '3', type: 'topup', amount: 10000, userId: 'user3', userName: 'Pedro Garcia', createdAt: new Date(Date.now() - 7200000) },
        { id: '4', type: 'payout', amount: 15000, userId: 'user4', userName: 'Ana Reyes', createdAt: new Date(Date.now() - 86400000) },
        { id: '5', type: 'refund', amount: 3000, userId: 'user5', userName: 'Jose Lopez', createdAt: new Date(Date.now() - 172800000) },
      ];
      setTransactions(mockTransactions);

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
  const filteredTransactions = transactions.filter(tx => {
    if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      tx.userName?.toLowerCase().includes(query) ||
      tx.userId?.toLowerCase().includes(query)
    );
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
      render: (_, row) => (
        <span className={cn(
          'font-semibold',
          row.type === 'payout' || row.type === 'fee' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        )}>
          {row.type === 'payout' || row.type === 'fee' ? '-' : '+'}₱{formatPrice(row.amount)}
        </span>
      ),
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
