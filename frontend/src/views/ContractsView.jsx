import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Filter,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  MapPin,
  Truck,
  Calendar,
  PenTool,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import { Badge } from '@/components/ui/badge';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import api from '@/services/api';

const statusConfig = {
  draft: {
    label: 'Pending Signature',
    icon: Clock,
    color: 'text-yellow-600',
    bgLight: 'bg-yellow-100',
    bgDark: 'bg-yellow-900/40',
    borderColor: 'border-yellow-200',
  },
  signed: {
    label: 'Active',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgLight: 'bg-green-100',
    bgDark: 'bg-green-900/40',
    borderColor: 'border-green-200',
  },
  in_transit: {
    label: 'In Transit',
    icon: Truck,
    color: 'text-blue-600',
    bgLight: 'bg-blue-100',
    bgDark: 'bg-blue-900/40',
    borderColor: 'border-blue-200',
  },
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-purple-600',
    bgLight: 'bg-purple-100',
    bgDark: 'bg-purple-900/40',
    borderColor: 'border-purple-200',
  },
  disputed: {
    label: 'Disputed',
    icon: AlertCircle,
    color: 'text-red-600',
    bgLight: 'bg-red-100',
    bgDark: 'bg-red-900/40',
    borderColor: 'border-red-200',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    color: 'text-gray-600',
    bgLight: 'bg-gray-100',
    bgDark: 'bg-gray-900/40',
    borderColor: 'border-gray-200',
  },
};

export function ContractsView({ darkMode, currentUser, onOpenContract, initialFilter = 'all', embedded = false }) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState(initialFilter);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch contracts
  useEffect(() => {
    const fetchContracts = async () => {
      setLoading(true);
      try {
        const response = await api.contracts.getAll();
        setContracts(response.contracts || []);
      } catch (error) {
        console.error('Error fetching contracts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContracts();
  }, []);

  // Filter contracts
  const filteredContracts = useMemo(() => {
    return contracts.filter((contract) => {
      // Status filter
      if (filterStatus === 'unpaid_fees') {
        // Show contracts with unpaid platform fees where current user is the payer
        if (contract.platformFeePaid !== false || contract.platformFeePayerId !== currentUser?.id) {
          return false;
        }
      } else if (filterStatus !== 'all' && contract.status !== filterStatus) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          contract.contractNumber?.toLowerCase().includes(query) ||
          contract.pickupAddress?.toLowerCase().includes(query) ||
          contract.deliveryAddress?.toLowerCase().includes(query) ||
          contract.cargoType?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [contracts, filterStatus, searchQuery, currentUser?.id]);

  // Group contracts by status
  const contractCounts = useMemo(() => {
    return {
      all: contracts.length,
      draft: contracts.filter((c) => c.status === 'draft').length,
      signed: contracts.filter((c) => c.status === 'signed').length,
      in_transit: contracts.filter((c) => c.status === 'in_transit').length,
      completed: contracts.filter((c) => c.status === 'completed').length,
      unpaid_fees: contracts.filter((c) => c.platformFeePaid === false && c.platformFeePayerId === currentUser?.id).length,
    };
  }, [contracts, currentUser?.id]);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '---';
    return `PHP ${Number(price).toLocaleString()}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '---';
    try {
      let date;
      // Handle Firestore Timestamp
      if (dateStr.toDate && typeof dateStr.toDate === 'function') {
        date = dateStr.toDate();
      }
      // Handle Firebase Timestamp object
      else if (dateStr.seconds) {
        date = new Date(dateStr.seconds * 1000);
      }
      // Handle string or number
      else {
        date = new Date(dateStr);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        return '---';
      }

      return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateStr);
      return '---';
    }
  };

  const toMillis = (value) => {
    if (!value) return 0;
    if (value.toDate && typeof value.toDate === 'function') return value.toDate().getTime();
    if (value.seconds) return value.seconds * 1000;
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const feeLedgerRows = useMemo(() => {
    // Only show platform fee ledger for contracts where current user is the fee payer
    return [...contracts]
      .filter((contract) => contract.platformFeePayerId === currentUser?.id)
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
      .map((contract) => ({
        id: contract.id,
        contractNumber: contract.contractNumber,
        route: `${contract.pickupCity || contract.pickupAddress || '---'} -> ${contract.deliveryCity || contract.deliveryAddress || '---'}`,
        amount: Number(contract.platformFee || 0),
        paid: contract.platformFeePaid === true,
        status: contract.platformFeePaid ? 'paid' : (contract.platformFeeStatus || 'outstanding'),
        dueDate: contract.platformFeeDueDate,
        paidAt: contract.platformFeePaidAt,
        createdAt: contract.createdAt,
      }));
  }, [contracts, currentUser?.id]);

  const feeLedgerSummary = useMemo(() => {
    const totalFees = feeLedgerRows.reduce((sum, row) => sum + row.amount, 0);
    const totalOutstanding = feeLedgerRows
      .filter((row) => !row.paid)
      .reduce((sum, row) => sum + row.amount, 0);
    const totalPaid = totalFees - totalOutstanding;
    return {
      totalFees,
      totalOutstanding,
      totalPaid,
      rows: feeLedgerRows.length,
    };
  }, [feeLedgerRows]);

  const getSignatureStatus = (contract) => {
    const isCargo = contract.listingType === 'cargo';
    const isListingOwner = currentUser?.id === contract.listingOwnerId;
    const isBidder = currentUser?.id === contract.bidderId;

    // For cargo listing: shipper=listing owner, trucker=bidder
    // For truck listing: trucker=listing owner, shipper=bidder
    const isShipper = isCargo ? isListingOwner : isBidder;

    const userSigned = isShipper ? !!contract.shipperSignature : !!contract.truckerSignature;
    const otherSigned = isShipper ? !!contract.truckerSignature : !!contract.shipperSignature;

    if (userSigned && otherSigned) return { status: 'both', label: 'Fully Signed' };
    if (userSigned) return { status: 'waiting', label: 'Waiting for Other Party' };
    return { status: 'pending', label: 'Your Signature Needed' };
  };

  return (
    <div className={cn("flex-1", !embedded && "bg-gray-50 dark:bg-gray-950 overflow-y-auto")} style={!embedded ? { padding: isMobile ? '16px' : '24px', paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : '24px' } : {}}>
      {/* Header - Only show when not embedded */}
      {!embedded && (
        <div style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div className="size-12 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <FileText className="size-6 text-white" />
            </div>
            <div>
              <h1 style={{
                fontWeight: 'bold',
                color: darkMode ? '#fff' : '#111827',
                fontSize: isMobile ? '20px' : '24px',
                marginBottom: '4px',
                lineHeight: '1.2'
              }}>My Contracts</h1>
              <p style={{
                color: darkMode ? '#9ca3af' : '#6b7280',
                fontSize: isMobile ? '12px' : '14px'
              }}>
                View and manage your transportation contracts
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: isMobile ? '20px' : '24px' }}>
        {/* Search */}
        <div style={{ position: 'relative', marginBottom: isMobile ? '12px' : '16px' }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by contract number, route, or cargo type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            style={{ padding: isMobile ? '10px 16px 10px 40px' : '12px 16px 12px 40px' }}
          />
        </div>

        {/* Status Tabs */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px'
        }}>
          <Filter style={{
            width: isMobile ? '16px' : '20px',
            height: isMobile ? '16px' : '20px'
          }} className="text-gray-500 flex-shrink-0" />
          {[
            { value: 'all', label: 'All', count: contractCounts.all },
            { value: 'unpaid_fees', label: 'Unpaid Fees', count: contractCounts.unpaid_fees },
            { value: 'draft', label: 'Pending', count: contractCounts.draft },
            { value: 'signed', label: 'Active', count: contractCounts.signed },
            { value: 'in_transit', label: 'In Transit', count: contractCounts.in_transit },
            { value: 'completed', label: 'Completed', count: contractCounts.completed },
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterStatus(filter.value)}
              className={cn(
                'rounded-lg font-medium whitespace-nowrap transition-all',
                filterStatus === filter.value
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )}
              style={{
                padding: isMobile ? '8px 14px' : '10px 16px',
                fontSize: isMobile ? '12px' : '14px'
              }}
            >
              {filter.label}
              {filter.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-xs">
                  {filter.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Platform Fee Ledger */}
      {feeLedgerRows.length > 0 && (
        <div
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
          style={{ marginBottom: isMobile ? '16px' : '20px', padding: isMobile ? '14px' : '16px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PesoIcon className="size-4 text-orange-500" />
              <h3 style={{ fontSize: isMobile ? '14px' : '16px', fontWeight: '700', color: darkMode ? '#fff' : '#111827' }}>
                Platform Fee Ledger
              </h3>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{feeLedgerSummary.rows} contracts</span>
          </div>

          <div className="grid grid-cols-3" style={{ gap: '8px', marginBottom: '12px' }}>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50" style={{ padding: '8px 10px' }}>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Total Fees</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatPrice(feeLedgerSummary.totalFees)}</p>
            </div>
            <div className="rounded-lg bg-green-50 dark:bg-green-900/20" style={{ padding: '8px 10px' }}>
              <p className="text-[11px] text-green-700 dark:text-green-300">Paid</p>
              <p className="text-sm font-semibold text-green-700 dark:text-green-300">{formatPrice(feeLedgerSummary.totalPaid)}</p>
            </div>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20" style={{ padding: '8px 10px' }}>
              <p className="text-[11px] text-orange-700 dark:text-orange-300">Outstanding</p>
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{formatPrice(feeLedgerSummary.totalOutstanding)}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            {feeLedgerRows.slice(0, 8).map((row) => (
              <div
                key={row.id}
                onClick={() => onOpenContract?.(row.id)}
                className="rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500 cursor-pointer"
                style={{ padding: '10px 12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">#{row.contractNumber || '---'}</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{formatPrice(row.amount)}</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.route}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span
                    className={cn(
                      'text-[11px] px-2 py-0.5 rounded-full font-medium',
                      row.status === 'paid' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                      row.status === 'overdue' && 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
                      row.status !== 'paid' && row.status !== 'overdue' && 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                    )}
                  >
                    {row.status === 'paid' ? 'Paid' : row.status === 'overdue' ? 'Overdue' : 'Outstanding'}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {row.status === 'paid'
                      ? `Paid ${formatDate(row.paidAt)}`
                      : row.dueDate
                      ? `Due ${formatDate(row.dueDate)}`
                      : `Created ${formatDate(row.createdAt)}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contracts List */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: '80px 0' }}>
          <Loader2 className="size-8 text-indigo-500 animate-spin" />
        </div>
      ) : filteredContracts.length === 0 ? (
        <div className="text-center" style={{ padding: '80px 0' }}>
          <div className="size-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto" style={{ marginBottom: '16px' }}>
            <FileText className="size-8 text-gray-400" />
          </div>
          <h3 style={{
            fontSize: isMobile ? '16px' : '18px',
            fontWeight: '600',
            color: darkMode ? '#fff' : '#111827',
            marginBottom: '8px'
          }}>
            No contracts found
          </h3>
          <p style={{
            color: darkMode ? '#9ca3af' : '#6b7280',
            fontSize: isMobile ? '12px' : '14px'
          }}>
            {searchQuery
              ? 'Try adjusting your search or filters'
              : filterStatus === 'all'
              ? 'Contracts will appear here once bids are accepted and platform fees are paid'
              : `No ${statusConfig[filterStatus]?.label.toLowerCase()} contracts`}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gap: isMobile ? '12px' : '16px'
        }}>
          {filteredContracts.map((contract) => {
            const config = statusConfig[contract.status] || statusConfig.draft;
            const StatusIcon = config.icon;
            const signatureStatus = getSignatureStatus(contract);

            return (
              <div
                key={contract.id}
                onClick={() => onOpenContract(contract.id)}
                className={cn(
                  'rounded-xl border-2 cursor-pointer transition-all hover:shadow-lg',
                  'bg-white dark:bg-gray-800',
                  config.borderColor,
                  'hover:border-indigo-400 dark:hover:border-indigo-500'
                )}
                style={{ padding: isMobile ? '16px' : '20px' }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: isMobile ? '12px' : '16px',
                  marginBottom: isMobile ? '12px' : '16px'
                }}>
                  {/* Contract Info */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    flex: 1,
                    minWidth: 0
                  }}>
                    <div
                      className={cn(
                        'size-12 rounded-xl flex items-center justify-center flex-shrink-0',
                        config.bgLight,
                        'dark:' + config.bgDark
                      )}
                    >
                      <StatusIcon className={cn('size-6', config.color)} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px'
                      }}>
                        <h3 style={{
                          fontWeight: 'bold',
                          color: darkMode ? '#fff' : '#111827',
                          fontSize: isMobile ? '14px' : '16px'
                        }}>
                          Contract #{contract.contractNumber}
                        </h3>
                        <Badge
                          className={cn(
                            'uppercase text-xs',
                            config.bgLight,
                            'dark:' + config.bgDark,
                            config.color
                          )}
                        >
                          {config.label}
                        </Badge>
                      </div>
                      <p style={{
                        fontSize: isMobile ? '12px' : '14px',
                        color: darkMode ? '#9ca3af' : '#6b7280'
                      }}>
                        {contract.cargoType} - {contract.cargoWeight} {contract.cargoWeightUnit}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{
                      fontSize: isMobile ? '11px' : '12px',
                      color: darkMode ? '#9ca3af' : '#6b7280'
                    }}>Contract Value</p>
                    <p style={{
                      fontSize: isMobile ? '16px' : '20px',
                      fontWeight: 'bold',
                      color: darkMode ? '#4ade80' : '#16a34a'
                    }}>
                      {formatPrice(contract.agreedPrice)}
                    </p>
                  </div>
                </div>

                {/* Route */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: isMobile ? '12px' : '16px',
                  padding: isMobile ? '10px' : '12px',
                  borderRadius: '8px',
                  backgroundColor: darkMode ? 'rgba(55, 65, 81, 0.5)' : '#f9fafb'
                }}>
                  <MapPin style={{ width: '16px', height: '16px' }} className="text-green-500 flex-shrink-0" />
                  <span style={{
                    fontSize: isMobile ? '12px' : '14px',
                    color: darkMode ? '#fff' : '#111827',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {contract.pickupAddress}
                  </span>
                  <span className="text-gray-400">{'->'}</span>
                  <MapPin style={{ width: '16px', height: '16px' }} className="text-red-500 flex-shrink-0" />
                  <span style={{
                    fontSize: isMobile ? '12px' : '14px',
                    color: darkMode ? '#fff' : '#111827',
                    fontWeight: '500',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {contract.deliveryAddress}
                  </span>
                </div>

                {/* Footer */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: isMobile ? '12px' : '16px',
                  fontSize: isMobile ? '12px' : '14px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? '12px' : '16px'
                  }}>
                    {/* Date */}
                    <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                      <Calendar className="size-4" />
                      <span>{formatDate(contract.createdAt)}</span>
                    </div>

                    {/* Signature Status (for draft contracts) */}
                    {contract.status === 'draft' && (
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded-full',
                          signatureStatus.status === 'pending' &&
                            'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
                          signatureStatus.status === 'waiting' &&
                            'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
                          signatureStatus.status === 'both' &&
                            'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                        )}
                      >
                        <PenTool className="size-3" />
                        <span className="text-xs font-medium">{signatureStatus.label}</span>
                      </div>
                    )}

                    {/* Platform Fee Status Badge (only show to the fee payer) */}
                    {!contract.platformFeePaid && contract.platformFeePayerId === currentUser?.id && (
                      <div
                        className={cn(
                          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
                          contract.platformFeeStatus === 'overdue'
                            ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                            : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                        )}
                      >
                        <AlertCircle className="size-3" />
                        {contract.platformFeeStatus === 'overdue' ? 'Fee Overdue' : 'Fee Unpaid'}
                      </div>
                    )}

                    {/* Tracking Number (for signed/in_transit contracts) */}
                    {(contract.status === 'signed' || contract.status === 'in_transit') &&
                      contract.shipment?.trackingNumber && (
                        <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                          <Truck className="size-4" />
                          <span className="font-mono font-medium">
                            {contract.shipment.trackingNumber}
                          </span>
                        </div>
                      )}
                  </div>

                  {/* Action hint */}
                  <span className="text-gray-400 dark:text-gray-500">
                    Click to view details {'->'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContractsView;



