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
} from 'lucide-react';
import { StatCard, StatCardSkeleton } from '@/components/admin/StatCard';
import { AppCard } from '@/components/ui/app-card';
import { AppButton } from '@/components/ui/app-button';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusChip } from '@/components/ui/status-chip';
import api from '@/services/api';

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

export function DashboardOverview({ badges, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [kpiSummary, setKpiSummary] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    fetchKpiData();
  }, []);

  const fetchKpiData = async () => {
    try {
      const kpiPayload = await api.admin.getMarketplaceKpis({ weeks: 8 });
      setKpiSummary(kpiPayload?.summary || null);
    } catch (error) {
      console.warn('Error fetching KPI summary:', error);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const overview = await api.admin.getDashboardOverview();
      const resolvedStats = overview?.stats || {};
      const resolvedActivity = Array.isArray(overview?.recentActivity) ? overview.recentActivity : [];

      setStats({
        totalUsers: resolvedStats.totalUsers || 0,
        shippers: resolvedStats.shippers || 0,
        truckers: resolvedStats.truckers || 0,
        totalListings: resolvedStats.totalListings || 0,
        openCargo: resolvedStats.openCargo || 0,
        availableTrucks: resolvedStats.availableTrucks || 0,
        totalContracts: resolvedStats.totalContracts || 0,
        activeContracts: resolvedStats.activeContracts || 0,
        pendingPayments: resolvedStats.pendingPayments || 0,
        approvedToday: resolvedStats.approvedToday || 0,
        rejectedToday: resolvedStats.rejectedToday || 0,
        totalAmountToday: resolvedStats.totalAmountToday || 0,
      });
      setLastUpdatedAt(overview?.meta?.asOf || null);

      const activityItems = resolvedActivity.map((item) => {
        const createdAt = item?.createdAt ? new Date(item.createdAt) : new Date();
        if (item.type === 'payment') {
          return {
            type: 'payment',
            message: item.message || `Payment submission (${item.status || 'pending'})`,
            time: formatTimeAgo(createdAt),
            icon: CreditCard,
            iconClassName: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
            chipVariant: 'secure',
          };
        }
        if (item.type === 'contract') {
          return {
            type: 'contract',
            message: item.message || `Contract ${item.status || 'created'}`,
            time: formatTimeAgo(createdAt),
            icon: FileText,
            iconClassName: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
            chipVariant: 'completed',
          };
        }
        return {
          type: 'user',
          message: item.message || `New ${item.status || 'user'} registered`,
          time: formatTimeAgo(createdAt),
          icon: Users,
          iconClassName: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
          chipVariant: 'transit',
        };
      });
      setRecentActivity(activityItems.slice(0, 8));
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
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Last updated: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString() : 'Unavailable'}
      </p>

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

    </div>
  );
}

export default DashboardOverview;
