import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Search,
  Filter,
  RefreshCw,
  ChevronDown,
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
import { cn } from '@/lib/utils';
import { PesoIcon } from '@/components/ui/PesoIcon';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/services/api';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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

// Fraud score indicator
function FraudScoreIndicator({ score }) {
  let color = 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
  let label = 'Low Risk';

  if (score > 70) {
    color = 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
    label = 'High Risk';
  } else if (score > 10) {
    color = 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    label = 'Medium Risk';
  }

  return (
    <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg', color)}>
      <Shield className="size-4" />
      <span className="font-bold">{score}</span>
      <span className="text-xs opacity-80">{label}</span>
    </div>
  );
}

// Payment detail modal
function PaymentDetailModal({ open, onClose, submission, onApprove, onReject, loading }) {
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!submission) return null;

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '0';
    return Number(price).toLocaleString();
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleApprove = () => {
    onApprove(submission.id, notes);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(submission.id, rejectionReason, notes);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
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
                  {submission.imageAnalysis.exif && (
                    <div className="col-span-2 flex justify-between">
                      <span className="text-gray-500">EXIF Present:</span>
                      <span className="text-gray-700 dark:text-gray-300">Yes</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="space-y-4">
            {/* Status & Fraud Score */}
            <div className="flex items-center justify-between">
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
                  <div className="flex justify-between">
                    <span className="text-blue-600 dark:text-blue-400">Timestamp:</span>
                    <span className="text-blue-900 dark:text-blue-200">
                      {submission.extractedData.timestamp || 'Not found'}
                    </span>
                  </div>
                  {submission.extractedData.confidence && (
                    <div className="flex justify-between">
                      <span className="text-blue-600 dark:text-blue-400">OCR Confidence:</span>
                      <span className={cn(
                        'font-medium',
                        submission.extractedData.confidence >= 70
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-yellow-600 dark:text-yellow-400'
                      )}>
                        {submission.extractedData.confidence}%
                      </span>
                    </div>
                  )}
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

            {/* Validation Results */}
            {submission.validationResults && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Validation Results
                </h4>
                <div className="space-y-1.5 text-sm">
                  {Object.entries(submission.validationResults).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-gray-500 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                      <span className={cn(
                        'font-medium',
                        value ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                      )}>
                        {value ? 'Pass' : 'Fail'}
                      </span>
                    </div>
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

// Main AdminPaymentsView component
export function AdminPaymentsView({ darkMode = false, className }) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('manual_review'); // Default to flagged
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

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '0';
    return Number(price).toLocaleString();
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  return (
    <main
      className={cn('flex-1 bg-gray-50 dark:bg-gray-950 overflow-y-auto', className)}
      style={{ padding: isMobile ? '16px 14px' : '32px' }}
    >
      {/* Header */}
      <div
        className={cn(
          isMobile ? "flex flex-col gap-3" : "flex items-center justify-between"
        )}
        style={{ marginBottom: isMobile ? '20px' : '32px' }}
      >
        <div>
          <h1 className={cn(
            "font-bold text-gray-900 dark:text-white",
            isMobile ? "text-lg" : "text-2xl mb-1"
          )}>
            Payment Review
          </h1>
          {!isMobile && (
            <p className="text-gray-600 dark:text-gray-400">
              Review and verify GCash payment submissions
            </p>
          )}
        </div>
        <Button
          onClick={() => { fetchSubmissions(); fetchStats(); }}
          variant="outline"
          size={isMobile ? "sm" : "default"}
          className="flex items-center gap-2"
        >
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div
          className={cn("grid grid-cols-2 lg:grid-cols-4", isMobile ? "gap-3" : "gap-4")}
          style={{ marginBottom: isMobile ? '16px' : '32px' }}
        >
          <div className={cn(
            "rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm",
            isMobile ? "p-3" : "p-4"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center",
                isMobile ? "size-8" : "size-10"
              )}>
                <AlertTriangle className={cn(isMobile ? "size-4" : "size-5", "text-yellow-600 dark:text-yellow-400")} />
              </div>
              <div>
                <p className={cn(
                  "font-bold text-gray-900 dark:text-white",
                  isMobile ? "text-lg" : "text-2xl"
                )}>{stats.stats?.pendingReview || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
              </div>
            </div>
          </div>

          <div className={cn(
            "rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm",
            isMobile ? "p-3" : "p-4"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center",
                isMobile ? "size-8" : "size-10"
              )}>
                <CheckCircle2 className={cn(isMobile ? "size-4" : "size-5", "text-green-600 dark:text-green-400")} />
              </div>
              <div>
                <p className={cn(
                  "font-bold text-gray-900 dark:text-white",
                  isMobile ? "text-lg" : "text-2xl"
                )}>{stats.stats?.approvedToday || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Approved</p>
              </div>
            </div>
          </div>

          <div className={cn(
            "rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm",
            isMobile ? "p-3" : "p-4"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center",
                isMobile ? "size-8" : "size-10"
              )}>
                <XCircle className={cn(isMobile ? "size-4" : "size-5", "text-red-600 dark:text-red-400")} />
              </div>
              <div>
                <p className={cn(
                  "font-bold text-gray-900 dark:text-white",
                  isMobile ? "text-lg" : "text-2xl"
                )}>{stats.stats?.rejectedToday || 0}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Rejected</p>
              </div>
            </div>
          </div>

          <div className={cn(
            "rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm",
            isMobile ? "p-3" : "p-4"
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                "rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center",
                isMobile ? "size-8" : "size-10"
              )}>
                <PesoIcon className={cn(isMobile ? "size-4" : "size-5", "text-blue-600 dark:text-blue-400")} />
              </div>
              <div>
                <p className={cn(
                  "font-bold text-gray-900 dark:text-white",
                  isMobile ? "text-base" : "text-2xl"
                )}>
                  {isMobile ? '₱' : 'PHP '}{formatPrice(stats.stats?.totalAmountToday || 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Today</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        className={cn("flex", isMobile ? "flex-col gap-3" : "flex-row gap-4")}
        style={{ marginBottom: isMobile ? '16px' : '24px' }}
      >
        <div className="relative flex-1">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-gray-400", isMobile ? "size-4" : "size-5")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isMobile ? "Search..." : "Search by order ID, user ID, or reference..."}
            className={cn(
              "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent",
              isMobile ? "pl-9 pr-3 py-2 text-sm" : "pl-10 pr-4 py-2.5"
            )}
          />
        </div>

        <div
          className={cn(
            "flex",
            isMobile ? "overflow-x-auto pb-2 -mx-3.5 px-3.5 scrollbar-hide" : ""
          )}
          style={{ gap: isMobile ? '8px' : '12px' }}
        >
          {['manual_review', 'processing', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={cn(
                'rounded-xl font-medium transition-all duration-300 active:scale-95 whitespace-nowrap',
                isMobile ? 'text-xs' : 'text-sm hover:scale-105',
                filter === status
                  ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              )}
              style={{ padding: isMobile ? '8px 16px' : '10px 24px' }}
            >
              {status === 'manual_review' ? 'Flagged' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-6">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="size-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="size-10 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Loading submissions...</p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="size-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4 shadow-lg">
            <CheckCircle2 className="size-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            No submissions to review
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {filter === 'manual_review'
              ? 'All flagged payments have been reviewed!'
              : `No ${filter} submissions found.`}
          </p>
        </div>
      ) : isMobile ? (
        /* Mobile Cards Layout */
        <div className="space-y-3">
          {filteredSubmissions.map((submission) => (
            <div
              key={submission.id}
              onClick={() => handleViewDetails(submission)}
              className="p-4 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    ₱{formatPrice(submission.orderAmount)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                    {submission.extractedData?.referenceNumber || submission.orderId?.slice(0, 12) + '...'}
                  </p>
                </div>
                <StatusBadge status={submission.status} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-2 py-1 rounded-lg text-xs font-bold',
                    submission.fraudScore > 70 ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                    submission.fraudScore > 10 ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  )}>
                    Score: {submission.fraudScore || 0}
                  </span>
                  {submission.fraudFlags?.length > 0 && (
                    <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-xs">
                      {submission.fraudFlags.length} flag{submission.fraudFlags.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(submission.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop Table Layout */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Submission
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Fraud Score
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Flags
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Submitted
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredSubmissions.map((submission) => (
                  <tr
                    key={submission.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleViewDetails(submission)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                          {submission.extractedData?.referenceNumber || 'No ref'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {submission.orderId?.slice(0, 12)}...
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900 dark:text-white">
                        PHP {formatPrice(submission.orderAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={submission.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'font-bold',
                        submission.fraudScore > 70 ? 'text-red-600 dark:text-red-400' :
                        submission.fraudScore > 10 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-green-600 dark:text-green-400'
                      )}>
                        {submission.fraudScore || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {submission.fraudFlags?.slice(0, 2).map((flag, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded text-xs"
                          >
                            {flag.rule?.replace(/_/g, ' ').slice(0, 12)}
                          </span>
                        ))}
                        {submission.fraudFlags?.length > 2 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded text-xs">
                            +{submission.fraudFlags.length - 2}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(submission.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDetails(submission);
                        }}
                      >
                        <Eye className="size-4 mr-1" />
                        Review
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
    </main>
  );
}

export default AdminPaymentsView;
