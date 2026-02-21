import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  Package,
  Truck,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Database,
  HardDrive,
} from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import api from '@/services/api';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/firebase';

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const PLATFORM_HEALTH = [
  { label: 'API Status', status: 'Operational', icon: ShieldCheck, gradient: 'from-green-400 to-green-600 shadow-green-500/30', cardBg: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20' },
  { label: 'Database', status: 'Connected', icon: Database, gradient: 'from-teal-400 to-teal-600 shadow-teal-500/30', cardBg: 'from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20' },
  { label: 'Payments', status: 'Active', icon: CreditCard, gradient: 'from-blue-400 to-blue-600 shadow-blue-500/30', cardBg: 'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20' },
  { label: 'Storage', status: 'Healthy', icon: HardDrive, gradient: 'from-purple-400 to-purple-600 shadow-purple-500/30', cardBg: 'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20' },
];

export function DashboardOverview({ badges, onNavigate }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [kpiSummary, setKpiSummary] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const paymentStats = await api.admin.getPaymentStats();
      const marketplaceKpis = await api.admin.getMarketplaceKpis({ weeks: 8 });
      const resolvedPaymentStats = paymentStats?.stats || paymentStats || {};

      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;
      let shippers = 0;
      let truckers = 0;
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === 'shipper') shippers++;
        if (data.role === 'trucker') truckers++;
      });

      const cargoSnapshot = await getDocs(collection(db, 'cargoListings'));
      const cargoCount = cargoSnapshot.size;
      let openCargo = 0;
      cargoSnapshot.forEach(doc => {
        if (doc.data().status === 'open') openCargo++;
      });

      const truckSnapshot = await getDocs(collection(db, 'truckListings'));
      const truckCount = truckSnapshot.size;
      let availableTrucks = 0;
      truckSnapshot.forEach(doc => {
        if (doc.data().status === 'available' || doc.data().status === 'open') availableTrucks++;
      });

      const contractsSnapshot = await getDocs(collection(db, 'contracts'));
      const contractCount = contractsSnapshot.size;
      let activeContracts = 0;
      contractsSnapshot.forEach(doc => {
        const status = doc.data().status;
        if (status === 'signed' || status === 'in_transit') activeContracts++;
      });

      setStats({
        totalUsers,
        shippers,
        truckers,
        totalListings: cargoCount + truckCount,
        openCargo,
        availableTrucks,
        totalContracts: contractCount,
        activeContracts,
        pendingPayments: resolvedPaymentStats.pendingReview || 0,
        approvedToday: resolvedPaymentStats.approvedToday || 0,
        rejectedToday: resolvedPaymentStats.rejectedToday || 0,
        totalAmountToday: resolvedPaymentStats.totalAmountToday || 0,
      });
      setKpiSummary(marketplaceKpis?.summary || null);

      const activityItems = [];
      try {
        const [recentPayments, recentContracts, recentUsers] = await Promise.all([
          getDocs(query(collection(db, 'paymentSubmissions'), orderBy('createdAt', 'desc'), limit(2))),
          getDocs(query(collection(db, 'contracts'), orderBy('createdAt', 'desc'), limit(2))),
          getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(2))),
        ]);
        recentPayments.forEach(doc => {
          const d = doc.data();
          activityItems.push({
            type: 'payment',
            message: `Payment submission (${d.status || 'pending'})`,
            time: formatTimeAgo(d.createdAt?.toDate?.() || new Date()),
            icon: CreditCard,
            iconGradient: 'from-blue-400 to-blue-600 shadow-blue-500/30',
            ts: d.createdAt?.toMillis?.() || 0,
          });
        });
        recentContracts.forEach(doc => {
          const d = doc.data();
          activityItems.push({
            type: 'contract',
            message: `Contract ${d.status || 'created'}`,
            time: formatTimeAgo(d.createdAt?.toDate?.() || new Date()),
            icon: FileText,
            iconGradient: 'from-purple-400 to-purple-600 shadow-purple-500/30',
            ts: d.createdAt?.toMillis?.() || 0,
          });
        });
        recentUsers.forEach(doc => {
          const d = doc.data();
          activityItems.push({
            type: 'user',
            message: `New ${d.role || 'user'} registered`,
            time: formatTimeAgo(d.createdAt?.toDate?.() || new Date()),
            icon: Users,
            iconGradient: 'from-green-400 to-green-600 shadow-green-500/30',
            ts: d.createdAt?.toMillis?.() || 0,
          });
        });
        activityItems.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      } catch (e) {
        console.error('Error fetching recent activity:', e);
      }
      setRecentActivity(activityItems.slice(0, 6));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { label: 'Review Payments', count: badges?.pendingPayments || 0, section: 'payments', icon: CreditCard, color: 'from-blue-400 to-blue-600' },
    { label: 'Verify Contracts', section: 'contractVerification', icon: ShieldCheck, color: 'from-indigo-400 to-indigo-600' },
    { label: 'Manage Users', section: 'users', icon: Users, color: 'from-green-400 to-green-600' },
    { label: 'View Contracts', section: 'contracts', icon: FileText, color: 'from-purple-400 to-purple-600' },
    { label: 'Track Shipments', section: 'shipments', icon: Truck, color: 'from-orange-400 to-orange-600' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              title="Total Users"
              value={stats?.totalUsers || 0}
              subtitle={`${stats?.shippers || 0} shippers, ${stats?.truckers || 0} truckers`}
              icon={Users}
              iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
              onClick={() => onNavigate('users')}
            />
            <StatCard
              title="Active Listings"
              value={stats?.totalListings || 0}
              subtitle={`${stats?.openCargo || 0} cargo, ${stats?.availableTrucks || 0} trucks`}
              icon={Package}
              iconColor="bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
              onClick={() => onNavigate('listings')}
            />
            <StatCard
              title="Contracts"
              value={stats?.totalContracts || 0}
              subtitle={`${stats?.activeContracts || 0} active`}
              icon={FileText}
              iconColor="bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
              onClick={() => onNavigate('contracts')}
            />
            <StatCard
              title="Today's Revenue"
              value={`₱${(stats?.totalAmountToday || 0).toLocaleString()}`}
              subtitle={`${stats?.approvedToday || 0} approved`}
              icon={CreditCard}
              iconColor="bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30"
              onClick={() => onNavigate('financial')}
            />
          </>
        )}
      </div>

      {/* KPI Snapshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Fee Recovery (8w)"
          value={`${(kpiSummary?.feeRecoveryRate || 0).toFixed(1)}%`}
          subtitle={`₱${(kpiSummary?.feesCollected || 0).toLocaleString()} collected`}
          icon={TrendingUp}
          iconColor="bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/30"
        />
        <StatCard
          title="Overdue Fees (8w)"
          value={kpiSummary?.overdueContracts || 0}
          subtitle={`${(kpiSummary?.suspensionRate || 0).toFixed(1)}% suspension rate`}
          icon={AlertTriangle}
          iconColor="bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30"
        />
        <StatCard
          title="Repeat Truckers (8w)"
          value={`${(kpiSummary?.repeatTruckerRate || 0).toFixed(1)}%`}
          subtitle={`${kpiSummary?.contractsCompleted || 0} completed contracts`}
          icon={Truck}
          iconColor="bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-indigo-500/30"
        />
        <StatCard
          title="Dispute Rate (8w)"
          value={`${(kpiSummary?.disputeRate || 0).toFixed(1)}%`}
          subtitle={`${kpiSummary?.disputesOpened || 0} disputes opened`}
          icon={ShieldCheck}
          iconColor="bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30"
        />
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Pending Payments"
          value={stats?.pendingPayments || 0}
          icon={Clock}
          iconColor="bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-500/30"
          onClick={() => onNavigate('payments')}
        />
        <StatCard
          title="Approved Today"
          value={stats?.approvedToday || 0}
          icon={CheckCircle2}
          iconColor="bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
        />
        <StatCard
          title="Rejected Today"
          value={stats?.rejectedToday || 0}
          icon={XCircle}
          iconColor="bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30"
        />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: isDesktop ? '24px' : '16px' }}>
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: isDesktop ? '24px' : '16px' }}>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Navigation</p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3" style={{ gap: isDesktop ? '12px' : '10px' }}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.section}
                  onClick={() => onNavigate(action.section)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-4 rounded-xl',
                    'bg-gradient-to-br', action.color,
                    'text-white shadow-lg hover:shadow-xl',
                    'hover:scale-105 active:scale-95 transition-all duration-300'
                  )}
                >
                  <div className="size-9 rounded-lg bg-white/20 flex items-center justify-center">
                    <Icon className="size-5" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight">{action.label}</span>
                  {action.count > 0 && (
                    <span className="px-2 py-0.5 bg-white/25 rounded-full text-xs font-medium">
                      {action.count} pending
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: isDesktop ? '24px' : '16px' }}>
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Live feed</p>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="size-12 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center mb-3">
                  <Clock className="size-6 text-gray-400 dark:text-gray-500" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Activity will appear as users interact with the platform</p>
              </div>
            ) : (
              recentActivity.map((activity, idx) => {
                const Icon = activity.icon;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={cn(
                      'size-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg flex-shrink-0',
                      activity.iconGradient
                    )}>
                      <Icon className="size-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {activity.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Platform Health */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: isDesktop ? '24px' : '16px' }}>
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Status</p>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Platform Health</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '16px' : '12px' }}>
          {PLATFORM_HEALTH.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div key={item.label} className={cn('flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br', item.cardBg)}>
                <div className={cn('size-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg flex-shrink-0', item.gradient)}>
                  <ItemIcon className="size-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="size-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.label}</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.status}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
