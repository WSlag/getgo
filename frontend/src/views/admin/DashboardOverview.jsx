import { useEffect, useState } from 'react';
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
import { AppCard } from '@/components/ui/app-card';
import { AppButton } from '@/components/ui/app-button';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusChip } from '@/components/ui/status-chip';
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
  {
    label: 'API Status',
    status: 'Operational',
    icon: ShieldCheck,
    iconClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    statusVariant: 'secure',
  },
  {
    label: 'Database',
    status: 'Connected',
    icon: Database,
    iconClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    statusVariant: 'accepted',
  },
  {
    label: 'Payments',
    status: 'Active',
    icon: CreditCard,
    iconClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    statusVariant: 'pending',
  },
  {
    label: 'Storage',
    status: 'Healthy',
    icon: HardDrive,
    iconClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    statusVariant: 'completed',
  },
];

export function DashboardOverview({ badges, onNavigate }) {
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
            iconClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
            chipVariant: 'secure',
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
            iconClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
            chipVariant: 'completed',
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
            iconClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
            chipVariant: 'transit',
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
    {
      label: 'Review Payments',
      count: badges?.pendingPayments || 0,
      section: 'payments',
      icon: CreditCard,
      iconClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    },
    {
      label: 'Verify Contracts',
      section: 'contractVerification',
      icon: ShieldCheck,
      iconClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    },
    {
      label: 'Manage Users',
      section: 'users',
      icon: Users,
      iconClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    },
    {
      label: 'View Contracts',
      section: 'contracts',
      icon: FileText,
      iconClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    },
    {
      label: 'Track Shipments',
      section: 'shipments',
      icon: Truck,
      iconClassName: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    },
  ];

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
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
              value={`PHP ${(stats?.totalAmountToday || 0).toLocaleString()}`}
              subtitle={`${stats?.approvedToday || 0} approved`}
              icon={CreditCard}
              iconColor="bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30"
              onClick={() => onNavigate('financial')}
            />
          </>
        )}
      </div>

      {/* KPI Snapshot */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        <StatCard
          title="Fee Recovery (8w)"
          value={`${(kpiSummary?.feeRecoveryRate || 0).toFixed(1)}%`}
          subtitle={`PHP ${(kpiSummary?.feesCollected || 0).toLocaleString()} collected`}
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
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-6">
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Quick Actions */}
        <AppCard>
          <SectionHeader
            title="Quick Actions"
            titleClassName="text-lg font-semibold tracking-normal"
          />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {quickActions.map(action => {
              const Icon = action.icon;
              return (
                <AppButton
                  key={action.section}
                  variant="secondary"
                  size="md"
                  onClick={() => onNavigate(action.section)}
                  className={cn(
                    'h-auto w-full min-h-32 flex-col items-start justify-between rounded-[14px] p-3 text-left',
                    'whitespace-normal hover:border-orange-200 hover:bg-slate-100 dark:hover:border-orange-700 dark:hover:bg-slate-800/90'
                  )}
                >
                  <div className="flex w-full items-start gap-3">
                    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-[10px]', action.iconClassName)}>
                      <Icon className="size-5" />
                    </div>
                    <span className="text-sm font-semibold leading-snug text-slate-900 dark:text-white">
                      {action.label}
                    </span>
                  </div>
                  <div className="flex min-h-6 items-center">
                    {action.count > 0 ? (
                      <StatusChip variant="pending" className="text-[11px]">
                        {action.count} pending
                      </StatusChip>
                    ) : (
                      <StatusChip variant="neutral" aria-hidden className="invisible text-[11px]">
                        0 pending
                      </StatusChip>
                    )}
                  </div>
                </AppButton>
              );
            })}
          </div>
        </AppCard>

        {/* Recent Activity */}
        <AppCard>
          <SectionHeader
            title="Recent Activity"
            titleClassName="text-lg font-semibold tracking-normal"
          />
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex size-12 items-center justify-center rounded-[10px] bg-slate-100 dark:bg-slate-800">
                  <Clock className="size-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">No recent activity</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Activity will appear as users interact with the platform</p>
              </div>
            ) : (
              recentActivity.map((activity, idx) => {
                const Icon = activity.icon;
                return (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-[10px] border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50"
                  >
                    <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-[10px]', activity.iconClassName)}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {activity.message}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activity.time}
                      </p>
                    </div>
                    <StatusChip variant={activity.chipVariant || 'neutral'} className="shrink-0 capitalize">
                      {activity.type}
                    </StatusChip>
                  </div>
                );
              })
            )}
          </div>
        </AppCard>
      </div>

      {/* Platform Health */}
      <AppCard>
        <SectionHeader
          title="Platform Health"
          titleClassName="text-lg font-semibold tracking-normal"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLATFORM_HEALTH.map(item => {
            const ItemIcon = item.icon;
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-[14px] border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50"
              >
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-[10px]', item.iconClassName)}>
                  <ItemIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.label}</p>
                  <div className="mt-1">
                    <StatusChip variant={item.statusVariant} className="text-[11px]">
                      {item.status}
                    </StatusChip>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </AppCard>
    </div>
  );
}

export default DashboardOverview;
