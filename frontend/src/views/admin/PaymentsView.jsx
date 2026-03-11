import { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  ExternalLink,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  User,
  Calendar,
  Hash,
  Flag,
  FileText,
} from 'lucide-react';
import { cn, getFraudScoreStyle, formatDate, formatPrice } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import { AppButton } from '@/components/ui/app-button';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppTextarea } from '@/components/ui/app-input';
import { AppSelect } from '@/components/ui/app-select';
import { StatusChip } from '@/components/ui/status-chip';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import api from '@/services/api';

const REJECTION_REASONS = [
  { value: 'invalid_screenshot', label: 'Invalid Screenshot' },
  { value: 'amount_mismatch', label: 'Amount Mismatch' },
  { value: 'duplicate_reference', label: 'Duplicate Reference Number' },
  { value: 'wrong_receiver', label: 'Wrong Receiver' },
  { value: 'suspected_fraud', label: 'Suspected Fraud' },
  { value: 'expired_receipt', label: 'Expired Receipt' },
  { value: 'unreadable', label: 'Unreadable Screenshot' },
  { value: 'other', label: 'Other' },
];

function StatusBadge({ status }) {
  const config = {
    pending: { variant: 'neutral', icon: Clock },
    processing: { variant: 'secure', icon: Loader2 },
    manual_review: { variant: 'pending', icon: AlertTriangle },
    approved: { variant: 'transit', icon: CheckCircle2 },
    rejected: { variant: 'cancelled', icon: XCircle },
  };

  const { variant, icon: Icon } = config[status] || config.pending;
  const label = status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pending';

  return (
    <StatusChip variant={variant} className="text-xs font-medium">
      <Icon className={cn('size-3.5', status === 'processing' && 'animate-spin')} />
      {label}
    </StatusChip>
  );
}

function FraudFlagBadge({ flag, score }) {
  const flagVariants = {
    AMOUNT_MISMATCH: 'cancelled',
    DUPLICATE_REFERENCE: 'verified',
    DUPLICATE_IMAGE: 'verified',
    SIMILAR_IMAGE: 'pending',
    RECEIVER_MISMATCH: 'pending',
    TIMESTAMP_EXPIRED: 'neutral',
    LOW_OCR_CONFIDENCE: 'secure',
    SUSPICIOUS_DIMENSIONS: 'neutral',
    MISSING_EXIF: 'neutral',
    NEW_ACCOUNT_HIGH_VALUE: 'pending',
    VELOCITY_EXCEEDED: 'cancelled',
  };

  return (
    <StatusChip variant={flagVariants[flag] || 'neutral'} className="px-2 py-0.5 text-[11px] font-medium">
      <Flag className="size-3" />
      {flag?.replace(/_/g, ' ')}
      {score && <span className="opacity-70">(+{score})</span>}
    </StatusChip>
  );
}

function normalizeFraudFlag(flag) {
  if (!flag) return { label: '', score: null };
  if (typeof flag === 'string') return { label: flag, score: null };
  return {
    label: String(flag.rule || flag.label || ''),
    score: typeof flag.score === 'number' ? flag.score : null,
  };
}

function FraudScoreIndicator({ score }) {
  const style = getFraudScoreStyle(score);
  const variant = score > 70 ? 'cancelled' : score > 10 ? 'pending' : 'transit';

  return (
    <StatusChip variant={variant} className={cn('px-3 py-1.5 text-xs', style.color)}>
      <Shield className="size-4" />
      <span className="font-bold">{score}</span>
      <span className="opacity-80">{style.label}</span>
    </StatusChip>
  );
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatSubmissionDate(value, options = {}) {
  const parsedDate = toDateValue(value);
  if (!parsedDate) return 'N/A';
  return formatDate(parsedDate, options);
}

function getDueStatus(contract) {
  const dueDate = toDateValue(contract?.platformFeeDueDate);
  if (!dueDate) {
    if (contract?.platformFeeStatus === 'overdue') {
      return { state: 'overdue', label: 'Overdue', days: null, dueDate: null };
    }
    return { state: 'pending_signing', label: 'Pending signing', days: null, dueDate: null };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((today.getTime() - dueDay.getTime()) / DAY_IN_MS);
  if (dayDiff > 0 || contract?.platformFeeStatus === 'overdue') {
    return {
      state: 'overdue',
      label: dayDiff > 0 ? `Overdue by ${dayDiff}d` : 'Overdue',
      days: dayDiff > 0 ? dayDiff : null,
      dueDate,
    };
  }
  if (dayDiff === 0) {
    return { state: 'due_today', label: 'Due today', days: 0, dueDate };
  }

  const daysUntilDue = Math.abs(dayDiff);
  if (daysUntilDue <= 3) {
    return { state: 'due_soon', label: `Due in ${daysUntilDue}d`, days: daysUntilDue, dueDate };
  }
  return { state: 'upcoming', label: `Due in ${daysUntilDue}d`, days: daysUntilDue, dueDate };
}

function isPayableOutstandingContract(contract) {
  if (!contract) return false;
  if (contract.platformFeePaid === true) return false;
  if (Number(contract.platformFee || 0) <= 0) return false;
  if (contract.status === 'cancelled') return false;
  if (contract.platformFeeStatus === 'waived') return false;
  return true;
}

// Payment detail modal
function PaymentDetailModal({ open, onClose, submission, onApprove, onReject, loading }) {
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const resetFormState = useCallback(() => {
    setNotes('');
    setRejectionReason('');
    setShowRejectForm(false);
  }, []);

  useEffect(() => {
    if (!open || !submission) {
      resetFormState();
    }
  }, [open, submission, resetFormState]);

  if (!submission) return null;

  const handleApprove = () => {
    onApprove(submission.id, notes);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(submission.id, rejectionReason, notes);
  };

  const handleDialogOpenChange = (nextOpen) => {
    if (!nextOpen) {
      resetFormState();
      onClose();
    }
  };

  return (
    <AppDialog
      open={open}
      onOpenChange={handleDialogOpenChange}
      title="Payment Submission Review"
      description={`Order: ${submission.orderId?.slice(0, 8) || 'N/A'}...`}
      className="max-w-4xl max-h-[85vh] lg:max-h-[90vh] overflow-y-auto"
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-[10px]',
            submission.status === 'manual_review'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
          )}
        >
          <FileText className="size-6" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Screenshot */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Payment Screenshot
            </h3>
            <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
              {submission.screenshotUrl ? (
                <img
                  src={submission.screenshotUrl}
                  alt="Payment screenshot"
                  className="w-full h-auto max-h-[500px] object-contain"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  <ImageIcon className="size-12" />
                </div>
              )}
              <a
                href={submission.screenshotUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute top-3 right-3 p-2 bg-black/50 rounded-lg text-white hover:bg-black/70 transition-colors"
              >
                <ExternalLink className="size-4" />
              </a>
            </div>

            {/* Image Analysis */}
            {submission.imageAnalysis && (
              <div className="mt-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image Analysis
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Dimensions:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {submission.imageAnalysis.width}x{submission.imageAnalysis.height}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hash:</span>
                    <span className="text-gray-700 dark:text-gray-300 font-mono">
                      {submission.imageAnalysis.hash?.slice(0, 12)}...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="space-y-4">
            {/* Status & Fraud Score */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <StatusBadge status={submission.status} />
              <FraudScoreIndicator score={submission.fraudScore || 0} />
            </div>

            {/* Order Details */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Order Details
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <PesoIcon className="size-4" /> Expected Amount:
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    PHP {formatPrice(submission.orderAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <User className="size-4" /> User ID:
                  </span>
                  <span className="font-mono text-gray-700 dark:text-gray-300 text-xs">
                    {submission.userId?.slice(0, 12)}...
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 flex items-center gap-1.5">
                    <Calendar className="size-4" /> Submitted:
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatSubmissionDate(submission.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* OCR Extracted Data */}
            {submission.extractedData && (
              <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3">
                  OCR Extracted Data
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <Hash className="size-4" /> Reference:
                    </span>
                    <span className="font-mono font-semibold text-blue-900 dark:text-blue-200">
                      {submission.extractedData.referenceNumber || 'Not found'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                      <PesoIcon className="size-4" /> Amount:
                    </span>
                    <span className={cn(
                      'font-semibold',
                      submission.extractedData.amount === submission.orderAmount
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    )}>
                      PHP {formatPrice(submission.extractedData.amount)}
                      {submission.extractedData.amount !== submission.orderAmount && (
                        <span className="ml-1 text-xs">(Mismatch!)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400">Receiver:</span>
                    <span className="text-blue-900 dark:text-blue-200">
                      {submission.extractedData.receiverName || 'Not found'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Fraud Flags */}
            {submission.fraudFlags && submission.fraudFlags.length > 0 && (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-3 flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  Fraud Flags ({submission.fraudFlags.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {submission.fraudFlags.map((flag, idx) => {
                    const normalized = normalizeFraudFlag(flag);
                    return <FraudFlagBadge key={idx} flag={normalized.label} score={normalized.score} />;
                  })}
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <AppTextarea
              label="Admin Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this review..."
              rows={2}
              textareaClassName="min-h-20"
            />

            {/* Action Buttons */}
            {submission.status === 'manual_review' && (
              <div className="space-y-3">
                {!showRejectForm ? (
                  <div className="flex gap-3">
                    <AppButton
                      onClick={handleApprove}
                      disabled={loading}
                      variant="success"
                      size="md"
                      className="flex-1"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 size-4" />
                      )}
                      Approve Payment
                    </AppButton>
                    <AppButton
                      onClick={() => setShowRejectForm(true)}
                      variant="danger"
                      size="md"
                      className="flex-1"
                    >
                      <XCircle className="mr-2 size-4" />
                      Reject
                    </AppButton>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <AppSelect
                      label="Rejection Reason (required)"
                      value={rejectionReason}
                      onValueChange={setRejectionReason}
                      options={REJECTION_REASONS}
                      placeholder="Select a reason..."
                    />
                    <div className="flex gap-2">
                      <AppButton
                        onClick={handleReject}
                        disabled={loading || !rejectionReason}
                        variant="danger"
                        size="md"
                        className="flex-1"
                      >
                        {loading ? (
                          <Loader2 className="mr-2 size-4 animate-spin" />
                        ) : (
                          <XCircle className="mr-2 size-4" />
                        )}
                        Confirm Rejection
                      </AppButton>
                      <AppButton
                        onClick={() => setShowRejectForm(false)}
                        variant="ghost"
                        size="md"
                      >
                        Cancel
                      </AppButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
    </AppDialog>
  );
}

// Main PaymentsView component
export function PaymentsView({ className }) {
  const [submissions, setSubmissions] = useState([]);
  const [outstandingContracts, setOutstandingContracts] = useState([]);
  const [outstandingSummary, setOutstandingSummary] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [outstandingLoading, setOutstandingLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [outstandingError, setOutstandingError] = useState(null);
  const [filter, setFilter] = useState('manual_review');
  const [outstandingFilter, setOutstandingFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [outstandingSearchQuery, setOutstandingSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const resolvedStats = stats?.stats || stats || {};
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const deferredOutstandingSearchQuery = useDeferredValue(outstandingSearchQuery);

  const dueSoonCount = useMemo(
    () =>
      outstandingContracts.reduce((count, contract) => {
        if (!isPayableOutstandingContract(contract)) return count;
        const dueState = contract._dueStatus?.state;
        return dueState === 'due_today' || dueState === 'due_soon' ? count + 1 : count;
      }, 0),
    [outstandingContracts]
  );

  // Fetch pending submissions
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getPendingPayments({ status: filter });
      const normalizedSubmissions = (data.submissions || []).map((submission) => ({
        ...submission,
        _searchText: [
          submission.userName,
          submission.userEmail,
          submission.orderId,
          submission.userId,
          submission.extractedData?.referenceNumber,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      }));
      setSubmissions(normalizedSubmissions);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const data = await api.admin.getPaymentStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchOutstandingFees = useCallback(async () => {
    setOutstandingLoading(true);
    setOutstandingError(null);
    try {
      const data = await api.admin.getOutstandingFees({ limit: 300 });
      const normalizedContracts = (data.contracts || []).map((contract) => ({
        ...contract,
        _dueStatus: getDueStatus(contract),
        _searchText: [
          contract.contractNumber,
          contract.id,
          contract.truckerName,
          contract.truckerEmail,
          contract.platformFeePayerId,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
      }));
      setOutstandingContracts(normalizedContracts);
      setOutstandingSummary(data.summary || null);
    } catch (err) {
      console.error('Error fetching outstanding platform fees:', err);
      setOutstandingError(err.message || 'Failed to load outstanding platform fees');
    } finally {
      setOutstandingLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubmissions();
    fetchStats();
  }, [fetchSubmissions, fetchStats]);

  useEffect(() => {
    fetchOutstandingFees();
  }, [fetchOutstandingFees]);

  // Handle approve
  const handleApprove = async (submissionId, notes) => {
    setActionLoading(true);
    try {
      await api.admin.approvePayment(submissionId, { notes });
      setShowDetailModal(false);
      setSelectedSubmission(null);
      fetchSubmissions();
      fetchStats();
      fetchOutstandingFees();
    } catch (err) {
      console.error('Error approving payment:', err);
      setError(err.message || 'Failed to approve payment');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle reject
  const handleReject = async (submissionId, reason, notes) => {
    setActionLoading(true);
    try {
      await api.admin.rejectPayment(submissionId, { reason, notes });
      setShowDetailModal(false);
      setSelectedSubmission(null);
      fetchSubmissions();
      fetchStats();
      fetchOutstandingFees();
    } catch (err) {
      console.error('Error rejecting payment:', err);
      setError(err.message || 'Failed to reject payment');
    } finally {
      setActionLoading(false);
    }
  };

  // View submission details
  const handleViewDetails = useCallback((submission) => {
    setSelectedSubmission(submission);
    setShowDetailModal(true);
  }, []);

  // Filter submissions by search
  const filteredSubmissions = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return submissions;
    return submissions.filter((submission) => submission._searchText?.includes(query));
  }, [submissions, deferredSearchQuery]);

  const filteredOutstandingContracts = useMemo(() => {
    const query = deferredOutstandingSearchQuery.trim().toLowerCase();

    return outstandingContracts.filter((contract) => {
      if (!isPayableOutstandingContract(contract)) {
        return false;
      }

      const due = contract._dueStatus || getDueStatus(contract);

      if (outstandingFilter === 'due_soon' && !(due.state === 'due_today' || due.state === 'due_soon')) {
        return false;
      }
      if (outstandingFilter === 'overdue' && due.state !== 'overdue') {
        return false;
      }
      if (outstandingFilter === 'suspended' && contract.truckerAccountStatus !== 'suspended') {
        return false;
      }

      if (!query) return true;
      return contract._searchText?.includes(query);
    });
  }, [outstandingContracts, outstandingFilter, deferredOutstandingSearchQuery]);

  // Table columns
  const columns = useMemo(() => [
    {
      key: 'reference',
      header: 'Submission',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {row.userName || row.userEmail || row.userId?.slice(0, 12) || 'Unknown user'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {row.extractedData?.referenceNumber || row.orderId?.slice(0, 12) || 'No ref'}
          </p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (_, row) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          PHP {formatPrice(row.orderAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (_, row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'fraudScore',
      header: 'Fraud Score',
      render: (_, row) => {
        const style = getFraudScoreStyle(row.fraudScore || 0);
        return (
          <span className={cn('font-bold', style.color)}>
            {row.fraudScore || 0}
          </span>
        );
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (_, row) => (
        <div className="max-w-xs space-x-1">
          {row.fraudFlags?.slice(0, 2).map((flag, idx) => (
            <FraudFlagBadge key={idx} flag={normalizeFraudFlag(flag).label} />
          ))}
          {row.fraudFlags?.length > 2 && (
            <StatusChip variant="neutral" className="px-1.5 py-0.5 text-xs font-medium">
              +{row.fraudFlags.length - 2}
            </StatusChip>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (_, row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatSubmissionDate(row.createdAt, { year: undefined })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (_, row) => (
        <AppButton
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            handleViewDetails(row);
          }}
          className="h-8 px-2"
        >
          <Eye className="mr-1 size-4" />
          Review
        </AppButton>
      ),
    },
  ], [handleViewDetails]);

  const outstandingColumns = useMemo(() => [
    {
      key: 'contract',
      header: 'Contract',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {row.contractNumber || row.id?.slice(0, 10)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {row.id?.slice(0, 12)}...
          </p>
        </div>
      ),
    },
    {
      key: 'trucker',
      header: 'Trucker',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {row.truckerName || 'Unknown'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {row.truckerEmail || row.platformFeePayerId?.slice(0, 12) || 'No email'}
          </p>
        </div>
      ),
    },
    {
      key: 'fee',
      header: 'Platform Fee',
      render: (_, row) => (
        <span className="font-semibold text-gray-900 dark:text-white">
          PHP {formatPrice(row.platformFee || 0)}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (_, row) => {
        const due = row._dueStatus || getDueStatus(row);
        return (
          <div>
            <p className="text-sm text-gray-900 dark:text-white">
              {due.dueDate ? formatDate(due.dueDate, { year: undefined }) : 'N/A'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{due.label}</p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Fee Status',
      render: (_, row) => {
        const due = row._dueStatus || getDueStatus(row);
        const config = {
          overdue: 'cancelled',
          due_today: 'pending',
          due_soon: 'pending',
          upcoming: 'secure',
          pending_signing: 'neutral',
          unknown: 'neutral',
        };
        return (
          <StatusChip variant={config[due.state] || config.unknown} className="text-xs font-medium">
            {due.label}
          </StatusChip>
        );
      },
    },
    {
      key: 'account',
      header: 'Account',
      render: (_, row) => (
        <StatusChip
          variant={row.truckerAccountStatus === 'suspended' ? 'cancelled' : 'transit'}
          className="text-xs font-medium"
        >
          {row.truckerAccountStatus === 'suspended' ? 'Suspended' : 'Active'}
        </StatusChip>
      ),
    },
  ], []);

  const submissionFilters = useMemo(
    () => (
      <>
        {['manual_review', 'processing', 'approved', 'rejected'].map((status) => (
          <FilterButton
            key={status}
            active={filter === status}
            onClick={() => setFilter(status)}
          >
            {status === 'manual_review' ? 'Flagged' : status.charAt(0).toUpperCase() + status.slice(1)}
          </FilterButton>
        ))}
      </>
    ),
    [filter]
  );

  const outstandingFilters = useMemo(
    () => (
      <>
        {[
          { id: 'all', label: 'All' },
          { id: 'due_soon', label: 'Due Soon' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'suspended', label: 'Suspended' },
        ].map(({ id, label }) => (
          <FilterButton
            key={id}
            active={outstandingFilter === id}
            onClick={() => setOutstandingFilter(id)}
          >
            {label}
          </FilterButton>
        ))}
      </>
    ),
    [outstandingFilter]
  );

  return (
    <div className={cn('flex flex-col gap-4 lg:gap-6', className)}>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
          <StatCard
            title="Pending Review"
            value={resolvedStats.pendingReview || 0}
            icon={AlertTriangle}
            iconColor="bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-500/30"
          />
          <StatCard
            title="Approved Today"
            value={resolvedStats.approvedToday || 0}
            icon={CheckCircle2}
            iconColor="bg-gradient-to-br from-green-400 to-green-600 shadow-green-500/30"
          />
          <StatCard
            title="Rejected Today"
            value={resolvedStats.rejectedToday || 0}
            icon={XCircle}
            iconColor="bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30"
          />
          <StatCard
            title="Total Today"
            value={`PHP ${formatPrice(resolvedStats.totalAmountToday || 0)}`}
            icon={PesoIcon}
            iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="size-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Table */}
      <DataTable
        columns={columns}
        data={filteredSubmissions}
        loading={loading}
        emptyMessage={
          filter === 'manual_review'
            ? 'All flagged payments have been reviewed!'
            : `No ${filter} submissions found.`
        }
        emptyIcon={CheckCircle2}
        onRowClick={handleViewDetails}
        searchable
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by username, order ID, user ID, or reference..."
        filters={submissionFilters}
      />

      {/* Outstanding Platform Fees */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Platform Fee Dues
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              All unpaid platform fees, including due and overdue balances.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
          <StatCard
            title="Unpaid Fees"
            value={outstandingSummary?.totalContracts || outstandingContracts.length}
            icon={Clock}
            iconColor="bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30"
          />
          <StatCard
            title="Due Soon"
            value={dueSoonCount}
            icon={AlertTriangle}
            iconColor="bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-500/30"
          />
          <StatCard
            title="Overdue"
            value={outstandingSummary?.overdueCount || 0}
            icon={XCircle}
            iconColor="bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/30"
          />
          <StatCard
            title="Total Outstanding"
            value={`PHP ${formatPrice(outstandingSummary?.totalOutstanding || 0)}`}
            icon={PesoIcon}
            iconColor="bg-gradient-to-br from-purple-400 to-purple-600 shadow-purple-500/30"
          />
        </div>

        {outstandingError && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="size-5" />
              <span>{outstandingError}</span>
            </div>
          </div>
        )}

        <DataTable
          columns={outstandingColumns}
          data={filteredOutstandingContracts}
          loading={outstandingLoading}
          emptyMessage="No outstanding platform fees found"
          emptyIcon={CheckCircle2}
          searchable
          searchQuery={outstandingSearchQuery}
          onSearchChange={setOutstandingSearchQuery}
          searchPlaceholder="Search by contract, trucker, email, or payer ID..."
          filters={outstandingFilters}
        />
      </div>

      {/* Payment Detail Modal */}
      <PaymentDetailModal
        open={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSubmission(null);
        }}
        submission={selectedSubmission}
        onApprove={handleApprove}
        onReject={handleReject}
        loading={actionLoading}
      />
    </div>
  );
}

export default PaymentsView;
