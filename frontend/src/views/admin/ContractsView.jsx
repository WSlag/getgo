import React, { useState, useEffect } from 'react';
import {
  FileText,
  Eye,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
} from 'lucide-react';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';

// Status badge
function StatusBadge({ status }) {
  const config = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: FileText },
    pending_signature: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
    signed: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: CheckCircle2 },
    in_transit: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', icon: Truck },
    completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
    disputed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: AlertTriangle },
    cancelled: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: XCircle },
  };

  const { bg, text, icon: Icon } = config[status] || config.draft;
  const label = status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Draft';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

export function ContractsView() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, disputed: 0 });

  // Fetch contracts
  const fetchContracts = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'contracts'), orderBy('createdAt', 'desc')));
      const contractsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setContracts(contractsData);

      // Calculate stats
      setStats({
        total: contractsData.length,
        active: contractsData.filter(c => c.status === 'signed' || c.status === 'in_transit').length,
        completed: contractsData.filter(c => c.status === 'completed').length,
        disputed: contractsData.filter(c => c.status === 'disputed').length,
      });
    } catch (error) {
      console.error('Error fetching contracts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, []);

  // Filter contracts
  const filteredContracts = contracts.filter(contract => {
    if (statusFilter !== 'all' && contract.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contract.contractNumber?.toLowerCase().includes(query) ||
      contract.pickupAddress?.toLowerCase().includes(query) ||
      contract.deliveryAddress?.toLowerCase().includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'contractNumber',
      header: 'Contract #',
      render: (_, row) => (
        <span className="font-mono font-medium text-gray-900 dark:text-white">
          {row.contractNumber || row.id?.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (_, row) => (
        <div className="flex items-start gap-2">
          <MapPin className="size-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-gray-900 dark:text-white truncate">
              {row.pickupAddress || 'N/A'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              to {row.deliveryAddress || 'N/A'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (_, row) => (
        <div>
          <p className="font-semibold text-gray-900 dark:text-white">
            ₱{formatPrice(row.agreedPrice)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Fee: ₱{formatPrice(row.platformFee)}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      header: 'Created',
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
          title="Total Contracts"
          value={stats.total}
          icon={FileText}
          iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={Truck}
          iconColor="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Disputed"
          value={stats.disputed}
          icon={AlertTriangle}
          iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredContracts}
        loading={loading}
        emptyMessage="No contracts found"
        emptyIcon={FileText}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by contract number or address..."
        filters={
          <>
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All
            </FilterButton>
            <FilterButton active={statusFilter === 'signed'} onClick={() => setStatusFilter('signed')}>
              Signed
            </FilterButton>
            <FilterButton active={statusFilter === 'in_transit'} onClick={() => setStatusFilter('in_transit')}>
              In Transit
            </FilterButton>
            <FilterButton active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')}>
              Completed
            </FilterButton>
            <FilterButton active={statusFilter === 'disputed'} onClick={() => setStatusFilter('disputed')}>
              Disputed
            </FilterButton>
          </>
        }
      />
    </div>
  );
}

export default ContractsView;
