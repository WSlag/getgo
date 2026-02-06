import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Search,
  RefreshCw,
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
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DataTable, FilterButton } from '@/components/admin/DataTable';
import { StatCard } from '@/components/admin/StatCard';
import api from '@/services/api';

// Status badge component
function StatusBadge({ status }) {
  const config = {
    pending: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400', icon: Clock },
    processing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', icon: Loader2 },
    manual_review: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', icon: AlertTriangle },
    approved: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', icon: CheckCircle2 },
    rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', icon: XCircle },
  };

  const { bg, text, icon: Icon } = config[status] || config.pending;
  const label = status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Pending';

  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon className={cn('size-3.5', status === 'processing' && 'animate-spin')} />
      {label}
    </span>
  );
}

// Fraud flag badge
function FraudFlagBadge({ flag, score }) {
  const flagColors = {
    AMOUNT_MISMATCH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    DUPLICATE_REFERENCE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    DUPLICATE_IMAGE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    SIMILAR_IMAGE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    RECEIVER_MISMATCH: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    TIMESTAMP_EXPIRED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    LOW_OCR_CONFIDENCE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SUSPICIOUS_DIMENSIONS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    MISSING_EXIF: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    NEW_ACCOUNT_HIGH_VALUE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    VELOCITY_EXCEEDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium',
      flagColors[flag] || 'bg-gray-100 text-gray-600'
    )}>
      <Flag className="size-3" />
      {flag?.replace(/_/g, ' ')}
      {score && <span className="opacity-70">(+{score})</span>}
    </span>
  );
}

// Fraud score indicator using shared utility
function FraudScoreIndicator({ score }) {
  const style = getFraudScoreStyle(score);

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg', style.bg, style.color)}>
      <Shield className="size-4" />
      <span className="font-bold">{score}</span>
      <span className="text-xs opacity-80">{style.label}</span>
    </div>
  );
}

// Fraud score badge (compact version)
function FraudScoreBadge({ score }) {
  const style = getFraudScoreStyle(score);
  return (
    <span className={cn('px-2 py-1 rounded-lg text-xs font-bold', style.bg, style.color)}>
      Score: {score}
    </span>
  );
}

// Payment detail modal
function PaymentDetailModal({ open, onClose, submission, onApprove, onReject, loading }) {
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!submission) return null;

  const handleApprove = () => {
    onApprove(submission.id, notes);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(submission.id, rejectionReason, notes);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] lg:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              'size-12 rounded-xl flex items-center justify-center',
              submission.status === 'manual_review'
                ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                : 'bg-gradient-to-br from-blue-400 to-blue-600'
            )}>
              <FileText className="size-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Payment Submission Review</DialogTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Order: {submission.orderId?.slice(0, 8)}...
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 mt-4" style={{ gap: '24px' }}>
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
                    {formatDate(submission.createdAt)}
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
                  {submission.fraudFlags.map((flag, idx) => (
                    <FraudFlagBadge key={idx} flag={flag.rule} score={flag.score} />
                  ))}
                </div>
              </div>
            )}

            {/* Admin Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Admin Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this review..."
                rows={2}
                className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Action Buttons */}
            {submission.status === 'manual_review' && (
              <div className="space-y-3">
                {!showRejectForm ? (
                  <div className="flex gap-3">
                    <Button
                      onClick={handleApprove}
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                    >
                      {loading ? (
                        <Loader2 className="size-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 className="size-4 mr-2" />
                      )}
                      Approve Payment
                    </Button>
                    <Button
                      onClick={() => setShowRejectForm(true)}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      <XCircle className="size-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <label className="block text-sm font-medium text-red-700 dark:text-red-300">
                      Rejection Reason (required)
                    </label>
                    <select
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-red-200 dark:border-red-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    >
                      <option value="">Select a reason...</option>
                      <option value="invalid_screenshot">Invalid Screenshot</option>
                      <option value="amount_mismatch">Amount Mismatch</option>
                      <option value="duplicate_reference">Duplicate Reference Number</option>
                      <option value="wrong_receiver">Wrong Receiver</option>
                      <option value="suspected_fraud">Suspected Fraud</option>
                      <option value="expired_receipt">Expired Receipt</option>
                      <option value="unreadable">Unreadable Screenshot</option>
                      <option value="other">Other</option>
                    </select>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleReject}
                        disabled={loading || !rejectionReason}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                      >
                        {loading ? (
                          <Loader2 className="size-4 animate-spin mr-2" />
                        ) : (
                          <XCircle className="size-4 mr-2" />
                        )}
                        Confirm Rejection
                      </Button>
                      <Button
                        onClick={() => setShowRejectForm(false)}
                        variant="ghost"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Main PaymentsView component
export function PaymentsView({ className }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('manual_review');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Fetch pending submissions
  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getPendingPayments({ status: filter });
      setSubmissions(data.submissions || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
      setError(err.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const data = await api.admin.getPaymentStats();
      setStats(data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    fetchStats();
  }, [filter]);

  // Handle approve
  const handleApprove = async (submissionId, notes) => {
    setActionLoading(true);
    try {
      await api.admin.approvePayment(submissionId, { notes });
      setShowDetailModal(false);
      setSelectedSubmission(null);
      fetchSubmissions();
      fetchStats();
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
    } catch (err) {
      console.error('Error rejecting payment:', err);
      setError(err.message || 'Failed to reject payment');
    } finally {
      setActionLoading(false);
    }
  };

  // View submission details
  const handleViewDetails = (submission) => {
    setSelectedSubmission(submission);
    setShowDetailModal(true);
  };

  // Filter submissions by search
  const filteredSubmissions = submissions.filter(s => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.orderId?.toLowerCase().includes(query) ||
      s.userId?.toLowerCase().includes(query) ||
      s.extractedData?.referenceNumber?.toLowerCase().includes(query)
    );
  });

  // Table columns
  const columns = [
    {
      key: 'reference',
      header: 'Submission',
      render: (_, row) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white text-sm">
            {row.extractedData?.referenceNumber || 'No ref'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            {row.orderId?.slice(0, 12)}...
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
        <div className="flex flex-wrap gap-1 max-w-xs">
          {row.fraudFlags?.slice(0, 2).map((flag, idx) => (
            <span
              key={idx}
              className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs"
            >
              {flag.rule?.replace(/_/g, ' ').slice(0, 12)}
            </span>
          ))}
          {row.fraudFlags?.length > 2 && (
            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded text-xs">
              +{row.fraudFlags.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      render: (_, row) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {formatDate(row.createdAt, { year: undefined })}
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
            handleViewDetails(row);
          }}
        >
          <Eye className="size-4 mr-1" />
          Review
        </Button>
      ),
    },
  ];

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', gap: isDesktop ? '28px' : '20px' }}>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: isDesktop ? '24px' : '12px' }}>
          <StatCard
            title="Pending Review"
            value={stats.stats?.pendingReview || 0}
            icon={AlertTriangle}
            iconColor="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400"
          />
          <StatCard
            title="Approved Today"
            value={stats.stats?.approvedToday || 0}
            icon={CheckCircle2}
            iconColor="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
          />
          <StatCard
            title="Rejected Today"
            value={stats.stats?.rejectedToday || 0}
            icon={XCircle}
            iconColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          />
          <StatCard
            title="Total Today"
            value={`₱${formatPrice(stats.stats?.totalAmountToday || 0)}`}
            icon={PesoIcon}
            iconColor="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
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
        searchPlaceholder="Search by order ID, user ID, or reference..."
        filters={
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
        }
      />

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
