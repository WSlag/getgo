import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Eye,
  CheckCircle2,
  Clock,
  MessageSquare,
  FileText,
  User,
  Calendar,
  Loader2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/firebase';

// Status badge
function StatusBadge({ status }) {
  const config = {
    open: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: AlertTriangle },
    investigating: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
    resolved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
  };

  const { bg, text, icon: Icon } = config[status] || config.open;
  const label = status?.charAt(0).toUpperCase() + status?.slice(1) || 'Open';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}

// Dispute detail modal
function DisputeDetailModal({ open, onClose, dispute, onResolve, loading }) {
  const [resolution, setResolution] = useState('');
  const [notes, setNotes] = useState('');

  if (!dispute) return null;

  const handleResolve = () => {
    if (!resolution) return;
    onResolve(dispute.id, resolution, notes);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center">
              <AlertTriangle className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Dispute Details</DialogTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Contract: {dispute.contractNumber || dispute.contractId?.slice(0, 8)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <StatusBadge status={dispute.status} />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Filed {formatDate(dispute.filedAt)}
            </span>
          </div>

          {/* Reason */}
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Dispute Reason</h4>
            <p className="text-sm text-red-600 dark:text-red-400">{dispute.reason || 'No reason provided'}</p>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <User className="size-4" /> Shipper
              </h4>
              <p className="text-sm text-gray-900 dark:text-white">{dispute.shipperName || 'N/A'}</p>
            </div>
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <User className="size-4" /> Trucker
              </h4>
              <p className="text-sm text-gray-900 dark:text-white">{dispute.truckerName || 'N/A'}</p>
            </div>
          </div>

          {/* Description */}
          {dispute.description && (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Description</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">{dispute.description}</p>
            </div>
          )}

          {/* Resolution (if open) */}
          {dispute.status === 'open' && (
            <div className="space-y-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Resolve Dispute</h4>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select resolution...</option>
                <option value="favor_shipper">In favor of Shipper</option>
                <option value="favor_trucker">In favor of Trucker</option>
                <option value="mutual">Mutual Agreement</option>
                <option value="dismissed">Dismissed</option>
              </select>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Resolution notes..."
                rows={3}
                className="w-full px-4 py-2 rounded-xl border border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400"
              />
              <Button
                onClick={handleResolve}
                disabled={loading || !resolution}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
              >
                {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <CheckCircle2 className="size-4 mr-2" />}
                Resolve Dispute
              </Button>
            </div>
          )}

          {/* Resolution info (if resolved) */}
          {dispute.status === 'resolved' && (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <h4 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">Resolution</h4>
              <p className="text-sm text-green-600 dark:text-green-400">{dispute.resolution || 'Resolved'}</p>
              {dispute.resolutionNotes && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2">{dispute.resolutionNotes}</p>
              )}
              <p className="text-xs text-green-500 dark:text-green-500 mt-2">
                Resolved on {formatDate(dispute.resolvedAt)}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DisputesManagement() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, open: 0, investigating: 0, resolved: 0 });

  // Fetch disputes
  const fetchDisputes = async () => {
    setLoading(true);
    try {
      // In production, this would fetch from a disputes collection
      // For now, we'll check contracts with disputed status
      const contractsSnapshot = await getDocs(
        query(collection(db, 'contracts'), where('status', '==', 'disputed'))
      );

      const disputesData = contractsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          contractId: doc.id,
          contractNumber: data.contractNumber,
          reason: data.disputeReason || 'Cargo damage',
          description: data.disputeDescription,
          status: 'open',
          filedAt: data.disputeFiledAt || data.updatedAt,
          shipperName: 'Shipper Name', // Would be fetched from users
          truckerName: 'Trucker Name',
        };
      });

      // Add mock data for demonstration
      if (disputesData.length === 0) {
        disputesData.push(
          { id: '1', contractNumber: 'CTR-001', reason: 'Cargo damage', status: 'open', filedAt: new Date(), shipperName: 'Juan Cruz', truckerName: 'Pedro Santos' },
          { id: '2', contractNumber: 'CTR-002', reason: 'Late delivery', status: 'investigating', filedAt: new Date(Date.now() - 86400000), shipperName: 'Maria Garcia', truckerName: 'Jose Lopez' },
          { id: '3', contractNumber: 'CTR-003', reason: 'Payment issue', status: 'resolved', filedAt: new Date(Date.now() - 172800000), resolvedAt: new Date(), resolution: 'In favor of Shipper', shipperName: 'Ana Reyes', truckerName: 'Carlos Tan' },
        );
      }

      setDisputes(disputesData);
      setStats({
        total: disputesData.length,
        open: disputesData.filter(d => d.status === 'open').length,
        investigating: disputesData.filter(d => d.status === 'investigating').length,
        resolved: disputesData.filter(d => d.status === 'resolved').length,
      });
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, []);

  // Handle resolve
  const handleResolve = async (disputeId, resolution, notes) => {
    setActionLoading(true);
    try {
      // Update dispute status
      // In production, this would update the disputes collection
      setShowDetailModal(false);
      fetchDisputes();
    } catch (error) {
      console.error('Error resolving dispute:', error);
    } finally {
      setActionLoading(false);
    }
  };

  // Filter disputes
  const filteredDisputes = disputes.filter(dispute => {
    if (statusFilter !== 'all' && dispute.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      dispute.contractNumber?.toLowerCase().includes(query) ||
      dispute.reason?.toLowerCase().includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'contract',
      header: 'Contract',
      render: (_, row) => (
        <span className="font-mono font-medium text-gray-900 dark:text-white">
          {row.contractNumber || row.contractId?.slice(0, 8)}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (_, row) => (
        <span className="text-sm text-gray-900 dark:text-white">{row.reason}</span>
      ),
    },
    {
      key: 'parties',
      header: 'Parties',
      render: (_, row) => (
        <div className="text-sm">
          <p className="text-gray-900 dark:text-white">{row.shipperName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">vs {row.truckerName}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'filedAt',
      header: 'Filed',
      render: (_, row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(row.filedAt, { year: undefined, hour: undefined, minute: undefined })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedDispute(row);
            setShowDetailModal(true);
          }}
        >
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
          title="Total Disputes"
          value={stats.total}
          icon={AlertTriangle}
          iconColor="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
        />
        <StatCard
          title="Open"
          value={stats.open}
          icon={AlertTriangle}
          iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
        <StatCard
          title="Investigating"
          value={stats.investigating}
          icon={Clock}
          iconColor="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          title="Resolved"
          value={stats.resolved}
          icon={CheckCircle2}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredDisputes}
        loading={loading}
        emptyMessage="No disputes found"
        emptyIcon={CheckCircle2}
        onRowClick={(row) => {
          setSelectedDispute(row);
          setShowDetailModal(true);
        }}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by contract number or reason..."
        filters={
          <>
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              All
            </FilterButton>
            <FilterButton active={statusFilter === 'open'} onClick={() => setStatusFilter('open')}>
              Open
            </FilterButton>
            <FilterButton active={statusFilter === 'investigating'} onClick={() => setStatusFilter('investigating')}>
              Investigating
            </FilterButton>
            <FilterButton active={statusFilter === 'resolved'} onClick={() => setStatusFilter('resolved')}>
              Resolved
            </FilterButton>
          </>
        }
      />

      <DisputeDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedDispute(null);
        }}
        dispute={selectedDispute}
        onResolve={handleResolve}
        loading={actionLoading}
      />
    </div>
  );
}

export default DisputesManagement;
