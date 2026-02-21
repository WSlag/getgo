import { useState, useEffect } from 'react';
import {
  FileText,
  Eye,
  MapPin,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Truck,
  Ban,
  Loader2,
} from 'lucide-react';
import { cn, formatDate, formatPrice } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';
import api from '@/services/api';

// Status badge
function StatusBadge({ status }) {
  const config = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: FileText },
    pending_payment: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', icon: Clock },
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
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, disputed: 0 });
  const [viewTarget, setViewTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionError, setActionError] = useState('');

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

  const canCancelContract = (contract) =>
    !!contract && contract.status !== 'completed' && contract.status !== 'cancelled';

  const openViewDialog = (contract) => {
    setViewTarget(contract);
  };

  const closeViewDialog = () => {
    setViewTarget(null);
  };

  const openCancelDialog = (contract) => {
    setActionError('');
    setCancelReason('');
    setCancelTarget(contract);
  };

  const closeCancelDialog = (forceClose = false) => {
    if (actionLoading && !forceClose) return;
    setCancelTarget(null);
    setCancelReason('');
    setActionError('');
  };

  const handleCancelContract = async () => {
    if (!cancelTarget || !canCancelContract(cancelTarget)) return;

    const reason = cancelReason.trim();
    if (!reason) {
      setActionError('Cancellation reason is required.');
      return;
    }

    setActionLoading(true);
    setActionError('');
    try {
      await api.contracts.cancel(cancelTarget.id, reason);
      await fetchContracts();
      closeCancelDialog(true);
    } catch (error) {
      setActionError(error.message || 'Failed to cancel contract.');
      console.error('Error cancelling contract:', error);
    } finally {
      setActionLoading(false);
    }
  };

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
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openViewDialog(row)}
          >
            <Eye className="size-4 mr-1" />
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canCancelContract(row) || actionLoading}
            className={cn(
              'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400',
              !canCancelContract(row) && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => openCancelDialog(row)}
          >
            <Ban className="size-4 mr-1" />
            Cancel
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Total Contracts"
          value={stats.total}
          icon={FileText}
          iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
        />
        <StatCard
          title="Active"
          value={stats.active}
          icon={Truck}
          iconColor="bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
        />
        <StatCard
          title="Completed"
          value={stats.completed}
          icon={CheckCircle2}
          iconColor="bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
        />
        <StatCard
          title="Disputed"
          value={stats.disputed}
          icon={AlertTriangle}
          iconColor="bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30"
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

      <Dialog
        open={!!viewTarget}
        onOpenChange={(open) => {
          if (!open) closeViewDialog();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Contract Details</DialogTitle>
            <DialogDescription>
              Review contract metadata and current execution state.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono text-sm font-semibold text-foreground">
                  {viewTarget?.contractNumber || viewTarget?.id}
                </p>
                <StatusBadge status={viewTarget?.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Agreed Price</p>
                <p className="text-sm font-semibold text-foreground">
                  PHP {formatPrice(viewTarget?.agreedPrice)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Platform Fee</p>
                <p className="text-sm font-semibold text-foreground">
                  PHP {formatPrice(viewTarget?.platformFee)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {formatDate(viewTarget?.createdAt)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-sm text-foreground flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground" />
                  {formatDate(viewTarget?.updatedAt)}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Shipper</p>
                <p className="text-sm text-foreground">
                  {viewTarget?.listingOwnerName || viewTarget?.listingOwnerId || 'N/A'}
                </p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Trucker</p>
                <p className="text-sm text-foreground">
                  {viewTarget?.bidderName || viewTarget?.bidderId || 'N/A'}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Route</p>
              <p className="text-sm text-foreground">
                {viewTarget?.pickupAddress || 'N/A'} to {viewTarget?.deliveryAddress || 'N/A'}
              </p>
            </div>

            {(viewTarget?.specialInstructions || viewTarget?.cancellationReason) && (
              <div className="space-y-3">
                {viewTarget?.specialInstructions && (
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Special Instructions</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {viewTarget.specialInstructions}
                    </p>
                  </div>
                )}
                {viewTarget?.cancellationReason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/40 p-3">
                    <p className="text-xs text-red-700 dark:text-red-300 mb-1">Cancellation Reason</p>
                    <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap">
                      {viewTarget.cancellationReason}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={closeViewDialog}>
              Close
            </Button>
            {canCancelContract(viewTarget) && (
              <Button
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
                onClick={() => {
                  openCancelDialog(viewTarget);
                  closeViewDialog();
                }}
                disabled={actionLoading}
              >
                <Ban className="size-4 mr-2" />
                Cancel Contract
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) closeCancelDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel Contract</DialogTitle>
            <DialogDescription>
              This will set the contract status to cancelled and notify both participants.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-sm font-medium text-foreground">
                {cancelTarget?.contractNumber || cancelTarget?.id}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Current status: {cancelTarget?.status || 'unknown'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="contract-cancel-reason">
                Cancellation reason
              </label>
              <Textarea
                id="contract-cancel-reason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Example: No activity from both parties after contract creation."
                rows={4}
                disabled={actionLoading}
              />
            </div>

            {actionError && (
              <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => closeCancelDialog()} disabled={actionLoading}>
              Close
            </Button>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
              onClick={handleCancelContract}
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Ban className="size-4 mr-2" />}
              Confirm Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ContractsView;
