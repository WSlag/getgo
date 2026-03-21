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
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  // Fetch financial data
  const fetchFinancialData = async () => {
    setLoading(true);
    try {
      const response = await api.admin.getFinancialOverview({ limit: 50 });
      const responseStats = response?.stats || {};
      const responseItems = response?.items || response?.transactions || [];

      setStats({
        totalRevenue: Number(responseStats.totalRevenue || 0),
        todayRevenue: Number(responseStats.todayRevenue || 0),
        weekRevenue: Number(responseStats.weekRevenue || 0),
        monthRevenue: Number(responseStats.monthRevenue || 0),
        totalWalletBalance: Number(responseStats.totalWalletBalance || 0),
        pendingPayouts: Number(responseStats.pendingPayouts || 0),
      });

      setTransactions(
        responseItems.map((tx) => ({
          ...tx,
          createdAt: tx?.createdAt ? new Date(tx.createdAt) : new Date(),
        }))
      );
      setLastUpdatedAt(response?.meta?.asOf || null);
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
            {isOutflow ? '-' : '+'}PHP {formatPrice(row.amount)}
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
          value={`PHP ${formatPrice(stats.todayRevenue)}`}
          icon={PesoIcon}
          iconColor="bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
        />
        <StatCard
          title="This Week"
          value={`PHP ${formatPrice(stats.weekRevenue)}`}
          icon={TrendingUp}
          iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
        />
        <StatCard
          title="This Month"
          value={`PHP ${formatPrice(stats.monthRevenue)}`}
          icon={Calendar}
          iconColor="bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
        />
        <StatCard
          title="All Time"
          value={`PHP ${formatPrice(stats.totalRevenue)}`}
          icon={PesoIcon}
          iconColor="bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30"
        />
      </div>

      {/* Wallet Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Total Wallet Balances"
          value={`PHP ${formatPrice(stats.totalWalletBalance)}`}
          subtitle="Combined balance of all users"
          icon={Wallet}
          iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
        />
        <StatCard
          title="Pending Payouts"
          value={`PHP ${formatPrice(stats.pendingPayouts)}`}
          subtitle="Awaiting processing"
          icon={CreditCard}
          iconColor="bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-500/30"
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : 'Unavailable'}
      </p>

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
