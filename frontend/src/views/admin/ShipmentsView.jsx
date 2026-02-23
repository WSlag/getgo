import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  MapPin,
  Navigation,
  Clock,
  CheckCircle2,
  Package,
  Eye,
  Loader2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import api from '@/services/api';

const ACTIVE_SHIPMENT_STATUSES = new Set(['pending_pickup', 'picked_up', 'in_transit']);
const SHIPMENTS_PAGE_SIZE = 200;

function normalizeStatus(status) {
  if (status === 'pending') return 'pending_pickup';
  return status || 'in_transit';
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?._seconds === 'number') return new Date(value._seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveLocationLabel(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if (typeof value.name === 'string') return value.name;
    if (typeof value.label === 'string') return value.label;
  }
  return '';
}

// Status badge
function StatusBadge({ status }) {
  const config = {
    pending: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600 dark:text-slate-400', icon: Clock },
    pending_pickup: { bg: 'bg-slate-100 dark:bg-slate-900/30', text: 'text-slate-600 dark:text-slate-400', icon: Clock },
    picked_up: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Package },
    in_transit: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: Truck },
    delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
  };

  const normalizedStatus = normalizeStatus(status);
  const { bg, text, icon: Icon } = config[normalizedStatus] || config.in_transit;
  const label = normalizedStatus?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'In Transit';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

// Progress bar
function ProgressBar({ progress }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">Progress</span>
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{progress}%</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function ShipmentsView() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [nextCursor, setNextCursor] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, inTransit: 0, delivered: 0 });

  // Fetch shipments
  const fetchShipments = useCallback(async ({ append = false, cursorValue = null } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setLoadError('');
      setNextCursor(null);
    }

    try {
      const response = await api.admin.getShipments({
        limit: SHIPMENTS_PAGE_SIZE,
        cursor: cursorValue || undefined,
      });
      const incomingShipments = (response?.shipments || []).map((shipment) => ({
        ...shipment,
        status: normalizeStatus(shipment.status),
        createdAt: toDateValue(shipment.createdAt),
        updatedAt: toDateValue(shipment.updatedAt),
        deliveredAt: toDateValue(shipment.deliveredAt),
        eta: toDateValue(shipment.eta),
      }));

      setNextCursor(response?.nextCursor || null);
      setShipments((prevShipments) => {
        const merged = append
          ? [
            ...prevShipments,
            ...incomingShipments.filter((incoming) => !prevShipments.some((existing) => existing.id === incoming.id)),
          ]
          : incomingShipments;

        setStats({
          total: merged.length,
          inTransit: merged.filter((shipment) => ACTIVE_SHIPMENT_STATUSES.has(shipment.status)).length,
          delivered: merged.filter((shipment) => shipment.status === 'delivered').length,
        });
        return merged;
      });
    } catch (error) {
      console.error('Error fetching shipments:', error);
      setLoadError(error?.message || 'Failed to load shipments');
      if (!append) {
        setShipments([]);
        setStats({ total: 0, inTransit: 0, delivered: 0 });
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchShipments({ append: false, cursorValue: null });
  }, [fetchShipments]);

  const handleLoadMore = () => {
    if (!nextCursor || loading || loadingMore) return;
    fetchShipments({ append: true, cursorValue: nextCursor });
  };

  // Filter shipments
  const filteredShipments = shipments.filter(shipment => {
    if (statusFilter !== 'all' && shipment.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const currentLocation = resolveLocationLabel(shipment.currentLocation).toLowerCase();
    return (
      shipment.trackingNumber?.toLowerCase().includes(query) ||
      currentLocation.includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'trackingNumber',
      header: 'Tracking #',
      render: (_, row) => (
        <span className="font-mono font-medium text-gray-900 dark:text-white">
          {row.trackingNumber || row.id?.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'location',
      header: 'Current Location',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Navigation className="size-4 text-orange-500" />
          <span className="text-sm text-gray-900 dark:text-white">
            {resolveLocationLabel(row.currentLocation) || 'Location updating...'}
          </span>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (_, row) => (
        <div className="w-32">
          <ProgressBar progress={row.progress || 0} />
        </div>
      ),
    },
    {
      key: 'eta',
      header: 'ETA',
      render: (_, row) => (
        <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          <Clock className="size-4" />
          {row.eta ? formatDate(row.eta, { year: undefined }) : 'Calculating...'}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: () => (
        <Button size="sm" variant="ghost">
          <Eye className="size-4 mr-1" />
          Track
        </Button>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Total Shipments"
          value={stats.total}
          icon={Package}
          iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
        />
        <StatCard
          title="In Transit"
          value={stats.inTransit}
          icon={Truck}
          iconColor="bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
        />
        <StatCard
          title="Delivered"
          value={stats.delivered}
          icon={CheckCircle2}
          iconColor="bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
        />
      </div>

      {/* Map placeholder */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm" style={{ padding: isDesktop ? '24px' : '16px' }}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Active Shipments Map</h3>
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded-xl flex items-center justify-center">
          <div className="text-center">
            <MapPin className="size-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 dark:text-gray-400">Live tracking map</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">Coming soon</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredShipments}
        loading={loading}
        emptyMessage={loadError || 'No shipments found'}
        emptyIcon={Truck}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by tracking number or location..."
        filters={
          <>
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All
            </FilterButton>
            <FilterButton active={statusFilter === 'picked_up'} onClick={() => setStatusFilter('picked_up')}>
              Picked Up
            </FilterButton>
            <FilterButton active={statusFilter === 'pending_pickup'} onClick={() => setStatusFilter('pending_pickup')}>
              Pending Pickup
            </FilterButton>
            <FilterButton active={statusFilter === 'in_transit'} onClick={() => setStatusFilter('in_transit')}>
              In Transit
            </FilterButton>
            <FilterButton active={statusFilter === 'delivered'} onClick={() => setStatusFilter('delivered')}>
              Delivered
            </FilterButton>
          </>
        }
      />

      {nextCursor && !loading && (
        <Button
          variant="outline"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full"
        >
          {loadingMore ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Loading...
            </>
          ) : (
            'Load More'
          )}
        </Button>
      )}
    </div>
  );
}

export default ShipmentsView;
