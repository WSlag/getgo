import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Users,
  Package,
  Truck,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
} from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import api from '@/services/api';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase';

export function DashboardOverview({ badges, onNavigate }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch payment stats
      const paymentStats = await api.admin.getPaymentStats();

      // Fetch user count from Firestore
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;

      // Count by role
      let shippers = 0;
      let truckers = 0;
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.role === 'shipper') shippers++;
        if (data.role === 'trucker') truckers++;
      });

      // Fetch cargo listings count
      const cargoSnapshot = await getDocs(collection(db, 'cargoListings'));
      const cargoCount = cargoSnapshot.size;
      let openCargo = 0;
      cargoSnapshot.forEach(doc => {
        if (doc.data().status === 'open') openCargo++;
      });

      // Fetch truck listings count
      const truckSnapshot = await getDocs(collection(db, 'truckListings'));
      const truckCount = truckSnapshot.size;
      let availableTrucks = 0;
      truckSnapshot.forEach(doc => {
        if (doc.data().status === 'available' || doc.data().status === 'open') availableTrucks++;
      });

      // Fetch contracts
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
        pendingPayments: paymentStats?.stats?.pendingReview || 0,
        approvedToday: paymentStats?.stats?.approvedToday || 0,
        rejectedToday: paymentStats?.stats?.rejectedToday || 0,
        totalAmountToday: paymentStats?.stats?.totalAmountToday || 0,
      });

      // Mock recent activity (TODO: implement real activity feed)
      setRecentActivity([
        { type: 'payment', message: 'New payment submission received', time: '2 mins ago', icon: CreditCard, color: 'text-blue-500' },
        { type: 'user', message: 'New trucker registered', time: '15 mins ago', icon: Users, color: 'text-green-500' },
        { type: 'contract', message: 'Contract #1234 completed', time: '1 hour ago', icon: CheckCircle2, color: 'text-green-500' },
        { type: 'listing', message: 'New cargo listing posted', time: '2 hours ago', icon: Package, color: 'text-orange-500' },
      ]);

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
              iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              onClick={() => onNavigate('users')}
            />
            <StatCard
              title="Active Listings"
              value={stats?.totalListings || 0}
              subtitle={`${stats?.openCargo || 0} cargo, ${stats?.availableTrucks || 0} trucks`}
              icon={Package}
              iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              onClick={() => onNavigate('listings')}
            />
            <StatCard
              title="Contracts"
              value={stats?.totalContracts || 0}
              subtitle={`${stats?.activeContracts || 0} active`}
              icon={FileText}
              iconColor="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
              onClick={() => onNavigate('contracts')}
            />
            <StatCard
              title="Today's Revenue"
              value={`₱${(stats?.totalAmountToday || 0).toLocaleString()}`}
              subtitle={`${stats?.approvedToday || 0} approved`}
              iconColor="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
              onClick={() => onNavigate('financial')}
            />
          </>
        )}
      </div>

      {/* Payment Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Pending Payments"
          value={stats?.pendingPayments || 0}
          icon={Clock}
          iconColor="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
          onClick={() => onNavigate('payments')}
        />
        <StatCard
          title="Approved Today"
          value={stats?.approvedToday || 0}
          icon={CheckCircle2}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Rejected Today"
          value={stats?.rejectedToday || 0}
          icon={XCircle}
          iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: isDesktop ? '24px' : '16px' }}>
        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: isDesktop ? '24px' : '16px' }}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3" style={{ gap: isDesktop ? '16px' : '12px' }}>
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
                    'hover:scale-105 active:scale-95 transition-all duration-200'
                  )}
                >
                  <Icon className="size-6" />
                  <span className="text-sm font-medium">{action.label}</span>
                  {action.count > 0 && (
                    <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs">
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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-4">
            {recentActivity.map((activity, idx) => {
              const Icon = activity.icon;
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className={cn('size-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center', activity.color)}>
                    <Icon className="size-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">
                      {activity.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.time}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Platform Health */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: isDesktop ? '24px' : '16px' }}>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Platform Health
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '16px' : '12px' }}>
          <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <div className="size-3 rounded-full bg-green-500 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">API Status</p>
            <p className="text-xs text-green-600 dark:text-green-500">Operational</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <div className="size-3 rounded-full bg-green-500 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Database</p>
            <p className="text-xs text-green-600 dark:text-green-500">Connected</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <div className="size-3 rounded-full bg-green-500 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Payments</p>
            <p className="text-xs text-green-600 dark:text-green-500">Active</p>
          </div>
          <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-900/20">
            <div className="size-3 rounded-full bg-green-500 mx-auto mb-2 animate-pulse" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">Storage</p>
            <p className="text-xs text-green-600 dark:text-green-500">Healthy</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardOverview;
