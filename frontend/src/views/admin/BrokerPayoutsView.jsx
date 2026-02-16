import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Landmark, XCircle } from 'lucide-react';
import api from '@/services/api';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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

function currency(value) {
  return `PHP ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BrokerPayoutsView() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState('');
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.admin.getBrokerPayoutRequests({
        status: statusFilter === 'all' ? 'all' : statusFilter,
        limit: 300,
      });
      setRequests(response?.requests || []);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load broker payout requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!searchQuery) return requests;
    const q = searchQuery.toLowerCase();
    return requests.filter((row) => (
      row.broker?.name?.toLowerCase().includes(q) ||
      row.broker?.phone?.toLowerCase().includes(q) ||
      row.id?.toLowerCase().includes(q)
    ));
  }, [requests, searchQuery]);

  const stats = useMemo(() => ({
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    pendingAmount: requests
      .filter((r) => r.status === 'pending')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0),
  }), [requests]);

  const reviewRequest = async (request, decision) => {
    if (request.status !== 'pending') return;

    const notes = window.prompt(
      decision === 'approve'
        ? 'Optional approval notes:'
        : 'Reason for rejection (required):',
      ''
    );

    if (decision === 'reject' && !String(notes || '').trim()) {
      return;
    }

    let payoutReference = null;
    if (decision === 'approve') {
      payoutReference = window.prompt('Payout reference (optional):', '') || null;
    }

    setActingId(request.id);
    try {
      await api.admin.reviewBrokerPayout(request.id, decision, {
        notes: notes || null,
        payoutReference,
      });
      await loadRequests();
    } catch (reviewError) {
      setError(reviewError.message || 'Failed to review payout request');
    } finally {
      setActingId('');
    }
  };

  const columns = [
    {
      key: 'broker',
      header: 'Broker',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{row.broker?.name || 'Unknown'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{row.broker?.phone || '-'}</p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Requested',
      render: (_, row) => formatDateTime(row.createdAt || row.requestedAt),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (value) => <span className="font-semibold">{currency(value)}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (value) => String(value || '-').toUpperCase(),
    },
    {
      key: 'status',
      header: 'Status',
      render: (value) => {
        const status = String(value || '').toLowerCase();
        const cls =
          status === 'approved'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
            : status === 'rejected'
              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
              : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>{status || 'pending'}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            disabled={row.status !== 'pending' || actingId === row.id}
            onClick={() => reviewRequest(row, 'approve')}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={row.status !== 'pending' || actingId === row.id}
            onClick={() => reviewRequest(row, 'reject')}
            className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400"
          >
            Reject
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
        <StatCard
          title="Pending Requests"
          value={stats.pending}
          icon={Clock3}
          iconColor="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
        />
        <StatCard
          title="Pending Amount"
          value={currency(stats.pendingAmount)}
          icon={Landmark}
          iconColor="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
        />
        <StatCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle2}
          iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
        />
        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        emptyMessage="No broker payout requests found"
        emptyIcon={Landmark}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search broker, phone, or request id..."
        filters={(
          <>
            <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</FilterButton>
            <FilterButton active={statusFilter === 'pending'} onClick={() => setStatusFilter('pending')}>Pending</FilterButton>
            <FilterButton active={statusFilter === 'approved'} onClick={() => setStatusFilter('approved')}>Approved</FilterButton>
            <FilterButton active={statusFilter === 'rejected'} onClick={() => setStatusFilter('rejected')}>Rejected</FilterButton>
          </>
        )}
      />
    </div>
  );
}

export default BrokerPayoutsView;
