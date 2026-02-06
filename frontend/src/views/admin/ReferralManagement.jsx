import React, { useState, useEffect } from 'react';
import {
  Link2,
  Users,
  DollarSign,
  TrendingUp,
  Eye,
  Award,
  Calendar,
} from 'lucide-react';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';

// Tier badge
function TierBadge({ tier }) {
  const config = {
    STARTER: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
    SILVER: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600 dark:text-slate-400' },
    GOLD: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
    PLATINUM: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
  };

  const { bg, text } = config[tier] || config.STARTER;

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Award className="size-3.5" />
      {tier || 'Starter'}
    </span>
  );
}

export function ReferralManagement() {
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, totalReferrals: 0, totalEarnings: 0, activeBrokers: 0 });

  // Fetch brokers
  const fetchBrokers = async () => {
    setLoading(true);
    try {
      // Fetch users who have referral codes (brokers)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const brokersData = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        // Check for broker profile
        const brokerProfileSnapshot = await getDocs(collection(db, 'users', userDoc.id, 'brokerProfile'));

        if (!brokerProfileSnapshot.empty) {
          const brokerData = brokerProfileSnapshot.docs[0].data();
          brokersData.push({
            id: userDoc.id,
            name: userData.name,
            phone: userData.phone,
            referralCode: brokerData.referralCode,
            tier: brokerData.tier || 'STARTER',
            totalReferrals: brokerData.totalReferrals || 0,
            totalEarnings: brokerData.totalEarnings || 0,
            pendingEarnings: brokerData.pendingEarnings || 0,
            createdAt: brokerData.createdAt || userData.createdAt,
          });
        }
      }

      // Sort by earnings
      brokersData.sort((a, b) => b.totalEarnings - a.totalEarnings);

      setBrokers(brokersData);

      // Calculate stats
      setStats({
        total: brokersData.length,
        totalReferrals: brokersData.reduce((sum, b) => sum + b.totalReferrals, 0),
        totalEarnings: brokersData.reduce((sum, b) => sum + b.totalEarnings, 0),
        activeBrokers: brokersData.filter(b => b.totalReferrals > 0).length,
      });
    } catch (error) {
      console.error('Error fetching brokers:', error);

      // Mock data for demonstration
      const mockBrokers = [
        { id: '1', name: 'Juan Cruz', phone: '+63912345678', referralCode: 'SHP12345', tier: 'GOLD', totalReferrals: 25, totalEarnings: 15000, pendingEarnings: 2000, createdAt: new Date() },
        { id: '2', name: 'Maria Santos', phone: '+63923456789', referralCode: 'TRK67890', tier: 'SILVER', totalReferrals: 12, totalEarnings: 8000, pendingEarnings: 500, createdAt: new Date() },
        { id: '3', name: 'Pedro Garcia', phone: '+63934567890', referralCode: 'SHP24680', tier: 'STARTER', totalReferrals: 3, totalEarnings: 1500, pendingEarnings: 0, createdAt: new Date() },
      ];
      setBrokers(mockBrokers);
      setStats({
        total: mockBrokers.length,
        totalReferrals: mockBrokers.reduce((sum, b) => sum + b.totalReferrals, 0),
        totalEarnings: mockBrokers.reduce((sum, b) => sum + b.totalEarnings, 0),
        activeBrokers: mockBrokers.filter(b => b.totalReferrals > 0).length,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrokers();
  }, []);

  // Filter brokers
  const filteredBrokers = brokers.filter(broker => {
    if (tierFilter !== 'all' && broker.tier !== tierFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      broker.name?.toLowerCase().includes(query) ||
      broker.referralCode?.toLowerCase().includes(query) ||
      broker.phone?.includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'broker',
      header: 'Broker',
      render: (_, row) => (
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold">
            {row.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{row.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{row.phone}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'referralCode',
      header: 'Code',
      render: (_, row) => (
        <span className="font-mono font-medium text-orange-600 dark:text-orange-400">
          {row.referralCode}
        </span>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (_, row) => <TierBadge tier={row.tier} />,
    },
    {
      key: 'referrals',
      header: 'Referrals',
      render: (_, row) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          {row.totalReferrals}
        </span>
      ),
    },
    {
      key: 'earnings',
      header: 'Earnings',
      render: (_, row) => (
        <div>
          <p className="font-semibold text-green-600 dark:text-green-400">
            ₱{formatPrice(row.totalEarnings)}
          </p>
          {row.pendingEarnings > 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              ₱{formatPrice(row.pendingEarnings)} pending
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <Button size="sm" variant="ghost">
          <Eye className="size-4 mr-1" />
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Brokers"
          value={stats.total}
          icon={Users}
          iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Active Brokers"
          value={stats.activeBrokers}
          icon={TrendingUp}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Total Referrals"
          value={stats.totalReferrals}
          icon={Link2}
          iconColor="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Total Commissions"
          value={`₱${formatPrice(stats.totalEarnings)}`}
          icon={DollarSign}
          iconColor="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
        />
      </div>

      {/* Commission Tiers Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Commission Tiers</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-center">
            <TierBadge tier="STARTER" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">3%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">0-10 referrals</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-center">
            <TierBadge tier="SILVER" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">4%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">11-25 referrals</p>
          </div>
          <div className="p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 text-center">
            <TierBadge tier="GOLD" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">5%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">26-50 referrals</p>
          </div>
          <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-900/20 text-center">
            <TierBadge tier="PLATINUM" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">6%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">50+ referrals</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredBrokers}
        loading={loading}
        emptyMessage="No brokers found"
        emptyIcon={Link2}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name, code, or phone..."
        filters={
          <>
            <FilterButton active={tierFilter === 'all'} onClick={() => setTierFilter('all')}>
              All Tiers
            </FilterButton>
            <FilterButton active={tierFilter === 'STARTER'} onClick={() => setTierFilter('STARTER')}>
              Starter
            </FilterButton>
            <FilterButton active={tierFilter === 'SILVER'} onClick={() => setTierFilter('SILVER')}>
              Silver
            </FilterButton>
            <FilterButton active={tierFilter === 'GOLD'} onClick={() => setTierFilter('GOLD')}>
              Gold
            </FilterButton>
            <FilterButton active={tierFilter === 'PLATINUM'} onClick={() => setTierFilter('PLATINUM')}>
              Platinum
            </FilterButton>
          </>
        }
      />
    </div>
  );
}

export default ReferralManagement;
