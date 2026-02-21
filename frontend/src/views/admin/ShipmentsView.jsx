import React, { useState, useEffect } from 'react';
import {
  Truck,
  MapPin,
  Navigation,
  Clock,
  CheckCircle2,
  Package,
  Eye,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';

// Status badge
function StatusBadge({ status }) {
  const config = {
    picked_up: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Package },
    in_transit: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: Truck },
    delivered: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
  };

  const { bg, text, icon: Icon } = config[status] || config.in_transit;
  const label = status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'In Transit';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, inTransit: 0, delivered: 0 });

  // Fetch shipments
  const fetchShipments = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'shipments'), orderBy('createdAt', 'desc')));
      const shipmentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setShipments(shipmentsData);

      // Calculate stats
      setStats({
        total: shipmentsData.length,
        inTransit: shipmentsData.filter(s => s.status === 'in_transit' || s.status === 'picked_up').length,
        delivered: shipmentsData.filter(s => s.status === 'delivered').length,
      });
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShipments();
  }, []);

  // Filter shipments
  const filteredShipments = shipments.filter(shipment => {
    if (statusFilter !== 'all' && shipment.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      shipment.trackingNumber?.toLowerCase().includes(query) ||
      shipment.currentLocation?.toLowerCase().includes(query)
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
            {row.currentLocation || 'Location updating...'}
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
      render: (_, row) => (
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
        emptyMessage="No shipments found"
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
            <FilterButton active={statusFilter === 'in_transit'} onClick={() => setStatusFilter('in_transit')}>
              In Transit
            </FilterButton>
            <FilterButton active={statusFilter === 'delivered'} onClick={() => setStatusFilter('delivered')}>
              Delivered
            </FilterButton>
          </>
        }
      />
    </div>
  );
}

export default ShipmentsView;
