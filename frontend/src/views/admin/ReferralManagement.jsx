import { useState, useEffect } from 'react';
import {
  Link2,
  Users,
  TrendingUp,
  Eye,
  Award,
  AlertTriangle,
  FileX,
} from 'lucide-react';
import { cn, formatPrice } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { SectionHeader } from '@/components/ui/section-header';
import { StatusChip } from '@/components/ui/status-chip';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import api from '@/services/api';

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

function php(value) {
  return `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortId(value) {
  const text = String(value || '');
  if (text.length <= 12) return text || '-';
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

const emptyReport = {
  summary: {
    scannedCancelledContracts: 0,
    unpaidCancelledContracts: 0,
    referredCancelledUnpaidContracts: 0,
    cargoCancelledUnpaidContracts: 0,
    truckCancelledUnpaidContracts: 0,
    waivedPlatformFees: 0,
    estimatedCommissionLost: 0,
    note: 'Cancelled contracts with unpaid platform fee are waived and do not generate broker commission.',
  },
  recentContracts: [],
  brokerBreakdown: [],
};

const tierChipVariant = {
  STARTER: 'neutral',
  SILVER: 'secure',
  GOLD: 'pending',
  PLATINUM: 'completed',
};

function TierChip({ tier, className }) {
  const normalizedTier = String(tier || 'STARTER').toUpperCase();
  const label = tier || 'Starter';
  const variant = tierChipVariant[normalizedTier] || tierChipVariant.STARTER;

  return (
    <StatusChip variant={variant} className={cn('h-6 justify-center whitespace-nowrap', className)}>
      <Award className="size-3.5" />
      {label}
    </StatusChip>
  );
}

export function ReferralManagement() {
  const [brokers, setBrokers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, totalReferrals: 0, totalEarnings: 0, activeBrokers: 0 });
  const [referralReport, setReferralReport] = useState(emptyReport);

  const fetchBrokers = async () => {
    setLoading(true);
    try {
      const [brokerResponse, reportResponse] = await Promise.all([
        api.admin.getBrokers({ limit: 300 }),
        api.admin.getBrokerReferralReport({ recentLimit: 30, scanLimit: 1000 }),
      ]);

      const brokersData = (brokerResponse?.brokers || []).map((broker) => ({
        id: broker.id,
        name: broker.user?.name || 'Unknown',
        phone: broker.user?.phone || '-',
        referralCode: broker.referralCode || '-',
        tier: broker.tier || 'STARTER',
        status: broker.status || 'active',
        totalReferrals: broker.totalReferrals || 0,
        totalEarnings: broker.totalEarnings || 0,
        pendingEarnings: broker.pendingEarnings || 0,
        createdAt: broker.createdAt || null,
      }));

      brokersData.sort((a, b) => b.totalEarnings - a.totalEarnings);
      setBrokers(brokersData);

      setStats({
        total: brokersData.length,
        totalReferrals: brokersData.reduce((sum, broker) => sum + broker.totalReferrals, 0),
        totalEarnings: brokersData.reduce((sum, broker) => sum + broker.totalEarnings, 0),
        activeBrokers: brokersData.filter((broker) => broker.status === 'active').length,
      });

      setReferralReport({
        summary: reportResponse?.summary || emptyReport.summary,
        recentContracts: reportResponse?.recentContracts || [],
        brokerBreakdown: reportResponse?.brokerBreakdown || [],
      });
    } catch (error) {
      console.error('Error fetching referral admin data:', error);
      setBrokers([]);
      setStats({
        total: 0,
        totalReferrals: 0,
        totalEarnings: 0,
        activeBrokers: 0,
      });
      setReferralReport(emptyReport);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBrokers();
  }, []);

  const filteredBrokers = brokers.filter((broker) => {
    if (tierFilter !== 'all' && broker.tier !== tierFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      broker.name?.toLowerCase().includes(query) ||
      broker.referralCode?.toLowerCase().includes(query) ||
      broker.phone?.includes(query)
    );
  });

  const brokerColumns = [
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
      render: (_, row) => <TierChip tier={row.tier} />,
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
            PHP {formatPrice(row.totalEarnings)}
          </p>
          {row.pendingEarnings > 0 && (
            <p className="text-xs text-yellow-600 dark:text-yellow-400">
              PHP {formatPrice(row.pendingEarnings)} pending
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: () => (
        <AppButton size="sm" variant="ghost">
          <Eye className="size-4 mr-1" />
          View
        </AppButton>
      ),
    },
  ];

  const recentCancelledColumns = [
    {
      key: 'contract',
      header: 'Contract',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.contractNumber || shortId(row.contractId)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{shortId(row.contractId)}</p>
        </div>
      ),
    },
    {
      key: 'broker',
      header: 'Broker',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.brokerName || 'Unknown'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.brokerCode || '-'}</p>
        </div>
      ),
    },
    {
      key: 'platformFeePayerId',
      header: 'Fee Payer',
      render: (value) => <span className="font-mono text-xs">{shortId(value)}</span>,
    },
    {
      key: 'listingType',
      header: 'Type',
      render: (value) => String(value || '-').toUpperCase(),
    },
    {
      key: 'platformFee',
      header: 'Waived Fee',
      render: (value) => <span className="font-medium">{php(value)}</span>,
    },
    {
      key: 'estimatedCommissionLost',
      header: 'Est. Lost Commission',
      render: (value) => <span className="font-semibold text-red-600 dark:text-red-400">{php(value)}</span>,
    },
    {
      key: 'cancelledAt',
      header: 'Cancelled',
      render: (value) => formatDateTime(value),
    },
  ];

  const brokerImpactColumns = [
    {
      key: 'broker',
      header: 'Broker',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.brokerName || 'Unknown'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.brokerCode || '-'}</p>
        </div>
      ),
    },
    {
      key: 'tier',
      header: 'Tier',
      render: (value) => <TierChip tier={value} />,
    },
    {
      key: 'contractsCancelledUnpaid',
      header: 'Cancelled/Unpaid',
      render: (value) => <span className="font-semibold">{value}</span>,
    },
    {
      key: 'waivedPlatformFees',
      header: 'Waived Fees',
      render: (value) => <span className="font-medium">{php(value)}</span>,
    },
    {
      key: 'estimatedCommissionLost',
      header: 'Est. Lost Commission',
      render: (value) => <span className="font-semibold text-red-600 dark:text-red-400">{php(value)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-5 lg:gap-7">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
        <StatCard
          title="Total Brokers"
          value={stats.total}
          icon={Users}
          iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
        />
        <StatCard
          title="Active Brokers"
          value={stats.activeBrokers}
          icon={TrendingUp}
          iconColor="bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
        />
        <StatCard
          title="Total Referrals"
          value={stats.totalReferrals}
          icon={Link2}
          iconColor="bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
        />
        <StatCard
          title="Total Commissions"
          value={`PHP ${formatPrice(stats.totalEarnings)}`}
          icon={PesoIcon}
          iconColor="bg-gradient-to-br from-orange-400 to-orange-600 shadow-orange-500/30"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:gap-4">
        <StatCard
          title="Referred Cancelled (Unpaid)"
          value={referralReport.summary.referredCancelledUnpaidContracts}
          icon={FileX}
          iconColor="bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30"
        />
        <StatCard
          title="Waived Referred Fees"
          value={php(referralReport.summary.waivedPlatformFees)}
          icon={AlertTriangle}
          iconColor="bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/30"
        />
        <StatCard
          title="Est. Commission Lost"
          value={php(referralReport.summary.estimatedCommissionLost)}
          icon={PesoIcon}
          iconColor="bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/30"
        />
      </div>

      <AppCard className="border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/15 lg:p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-200">
              Edge Case: Cancelled Contract Before Fee Payment
            </h3>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
              {referralReport.summary.note}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              Cargo: {referralReport.summary.cargoCancelledUnpaidContracts} | Truck: {referralReport.summary.truckCancelledUnpaidContracts} | Scanned cancelled contracts: {referralReport.summary.scannedCancelledContracts}
            </p>
          </div>
        </div>
      </AppCard>

      <AppCard className="p-4 lg:p-6">
        <SectionHeader
          title="Commission Tiers"
          titleClassName="text-lg font-semibold tracking-normal"
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          <div className="rounded-[14px] bg-slate-50 p-4 text-center dark:bg-slate-800/50">
            <TierChip tier="STARTER" className="mx-auto" />
            <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">3%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">0-10 referrals</p>
          </div>
          <div className="p-4 rounded-[14px] bg-slate-50 dark:bg-slate-900/50 text-center">
            <TierChip tier="SILVER" className="mx-auto" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">4%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">11-25 referrals</p>
          </div>
          <div className="p-4 rounded-[14px] bg-yellow-50 dark:bg-yellow-900/20 text-center">
            <TierChip tier="GOLD" className="mx-auto" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">5%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">26-50 referrals</p>
          </div>
          <div className="p-4 rounded-[14px] bg-purple-50 dark:bg-purple-900/20 text-center">
            <TierChip tier="PLATINUM" className="mx-auto" />
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">6%</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">50+ referrals</p>
          </div>
        </div>
      </AppCard>

      <DataTable
        columns={brokerColumns}
        data={filteredBrokers}
        loading={loading}
        emptyMessage="No brokers found"
        emptyIcon={Link2}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name, code, or phone..."
        filters={(
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
        )}
      />

      <DataTable
        columns={recentCancelledColumns}
        data={referralReport.recentContracts}
        loading={loading}
        emptyMessage="No referred cancelled unpaid contracts found"
        emptyIcon={FileX}
        className="mt-1"
      />

      <DataTable
        columns={brokerImpactColumns}
        data={referralReport.brokerBreakdown}
        loading={loading}
        emptyMessage="No broker impact data yet"
        emptyIcon={AlertTriangle}
      />
    </div>
  );
}

export default ReferralManagement;
