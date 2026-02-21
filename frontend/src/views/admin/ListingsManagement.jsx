import React, { useState, useEffect } from 'react';
import {
  Package,
  Truck,
  Eye,
  Ban,
  MapPin,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';
import api from '@/services/api';

// Status badge
function StatusBadge({ status }) {
  const config = {
    open: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    available: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
    negotiating: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400' },
    contracted: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400' },
    in_transit: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
    completed: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
    delivered: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
    deactivated: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400' },
  };

  const { bg, text } = config[status] || config.open;
  const label = status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Open';

  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      {label}
    </span>
  );
}

// Type badge
function TypeBadge({ type }) {
  const isCargo = type === 'cargo';
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
      isCargo
        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
        : 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
    )}>
      {isCargo ? <Package className="size-3.5" /> : <Truck className="size-3.5" />}
      {isCargo ? 'Cargo' : 'Truck'}
    </span>
  );
}

export function ListingsManagement() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ cargo: 0, trucks: 0, openCargo: 0, availableTrucks: 0 });

  // Fetch listings
  const fetchListings = async () => {
    setLoading(true);
    try {
      // Fetch cargo listings
      const cargoSnapshot = await getDocs(query(collection(db, 'cargoListings'), orderBy('createdAt', 'desc')));
      const cargoListings = cargoSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'cargo',
        ...doc.data(),
      }));

      // Fetch truck listings
      const truckSnapshot = await getDocs(query(collection(db, 'truckListings'), orderBy('createdAt', 'desc')));
      const truckListings = truckSnapshot.docs.map(doc => ({
        id: doc.id,
        type: 'truck',
        ...doc.data(),
      }));

      // Combine and sort
      const allListings = [...cargoListings, ...truckListings].sort((a, b) => {
        const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return bDate - aDate;
      });

      setListings(allListings);

      // Calculate stats
      setStats({
        cargo: cargoListings.length,
        trucks: truckListings.length,
        openCargo: cargoListings.filter(l => l.status === 'open').length,
        availableTrucks: truckListings.filter(l => l.status === 'available' || l.status === 'open').length,
      });
    } catch (error) {
      console.error('Error fetching listings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  // Handle deactivate listing
  const handleDeactivate = async (listing) => {
    try {
      await api.admin.deactivateListing(listing.id, listing.type, {
        reason: 'Deactivated via admin dashboard',
      });
      await fetchListings();
    } catch (error) {
      console.error('Error deactivating listing:', error);
    }
  };

  // Filter listings
  const filteredListings = listings.filter(listing => {
    // Type filter
    if (typeFilter !== 'all' && listing.type !== typeFilter) return false;

    // Status filter
    if (statusFilter !== 'all' && listing.status !== statusFilter) return false;

    // Search filter
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      listing.origin?.toLowerCase().includes(query) ||
      listing.destination?.toLowerCase().includes(query) ||
      listing.cargoType?.toLowerCase().includes(query) ||
      listing.vehicleType?.toLowerCase().includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'type',
      header: 'Type',
      render: (_, row) => <TypeBadge type={row.type} />,
    },
    {
      key: 'route',
      header: 'Route',
      render: (_, row) => (
        <div className="flex items-start gap-2">
          <MapPin className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {row.origin || 'N/A'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              to {row.destination || 'N/A'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'details',
      header: 'Details',
      render: (_, row) => (
        <div className="text-sm">
          <p className="text-gray-900 dark:text-white">
            {row.type === 'cargo' ? row.cargoType : row.vehicleType}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.type === 'cargo'
              ? `${row.weight} ${row.weightUnit || 'kg'}`
              : `${row.capacity} ${row.capacityUnit || 'kg'} capacity`}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (_, row) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          ₱{formatPrice(row.askingPrice)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      header: 'Posted',
      render: (_, row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(row.createdAt, { year: undefined, hour: undefined, minute: undefined })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="ghost">
            <Eye className="size-4" />
          </Button>
          {row.status !== 'deactivated' && row.status !== 'completed' && row.status !== 'delivered' && (
            <Button
              size="sm"
              variant="ghost"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={(e) => {
                e.stopPropagation();
                handleDeactivate(row);
              }}
            >
              <Ban className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Total Cargo"
          value={stats.cargo}
          subtitle={`${stats.openCargo} open`}
          icon={Package}
          iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Total Trucks"
          value={stats.trucks}
          subtitle={`${stats.availableTrucks} available`}
          icon={Truck}
          iconColor="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Open Cargo"
          value={stats.openCargo}
          icon={CheckCircle2}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Available Trucks"
          value={stats.availableTrucks}
          icon={CheckCircle2}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredListings}
        loading={loading}
        emptyMessage="No listings found"
        emptyIcon={Package}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by origin, destination, or type..."
        filters={
          <>
            <FilterButton active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
              All Types
            </FilterButton>
            <FilterButton active={typeFilter === 'cargo'} onClick={() => setTypeFilter('cargo')}>
              Cargo
            </FilterButton>
            <FilterButton active={typeFilter === 'truck'} onClick={() => setTypeFilter('truck')}>
              Trucks
            </FilterButton>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All Status
            </FilterButton>
            <FilterButton active={statusFilter === 'open'} onClick={() => setStatusFilter('open')}>
              Open
            </FilterButton>
            <FilterButton active={statusFilter === 'contracted'} onClick={() => setStatusFilter('contracted')}>
              Contracted
            </FilterButton>
          </>
        }
      />
    </div>
  );
}

export default ListingsManagement;
