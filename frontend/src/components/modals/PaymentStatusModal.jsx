import React from 'react';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Wallet
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useOrderSubmission, usePaymentOrder, getStatusDisplay } from '@/hooks/usePaymentSubmission';

export function PaymentStatusModal({
  open,
  onClose,
  orderId,
  onRetry,
  onViewWallet,
}) {
  const { submission, loading: loadingSubmission } = useOrderSubmission(orderId);
  const { order, loading: loadingOrder } = usePaymentOrder(orderId);

  const loading = loadingSubmission || loadingOrder;
  const status = submission?.status || 'pending';
  const statusInfo = getStatusDisplay(status);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '0';
    return Number(price).toLocaleString();
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'approved':
        return (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(to bottom right, #22c55e, #16a34a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.4)',
          }}>
            <CheckCircle2 style={{ width: '40px', height: '40px', color: 'white' }} />
          </div>
        );
      case 'rejected':
        return (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(to bottom right, #ef4444, #dc2626)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.4)',
          }}>
            <XCircle style={{ width: '40px', height: '40px', color: 'white' }} />
          </div>
        );
      case 'manual_review':
        return (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(to bottom right, #f59e0b, #d97706)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            boxShadow: '0 10px 25px -5px rgba(245, 158, 11, 0.4)',
          }}>
            <Clock style={{ width: '40px', height: '40px', color: 'white' }} />
          </div>
        );
      case 'processing':
        return (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(to bottom right, #3b82f6, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)',
          }}>
            <Loader2 style={{
              width: '40px',
              height: '40px',
              color: 'white',
              animation: 'spin 1.5s linear infinite'
            }} />
          </div>
        );
      default:
        return (
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(to bottom right, #6b7280, #4b5563)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
          }}>
            <Clock style={{ width: '40px', height: '40px', color: 'white' }} />
          </div>
        );
    }
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle style={{ textAlign: 'center', fontSize: '20px' }}>
            Payment Status
          </DialogTitle>
        </DialogHeader>

        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          {/* Loading State */}
          {loading ? (
            <>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
              }}>
                <Loader2 style={{
                  width: '40px',
                  height: '40px',
                  color: '#9ca3af',
                  animation: 'spin 1s linear infinite'
                }} />
              </div>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                marginTop: '20px',
              }}>
                Loading...
              </p>
            </>
          ) : (
            <>
              {/* Status Icon */}
              {getStatusIcon()}

              {/* Status Text */}
              <h3 style={{
                fontSize: '22px',
                fontWeight: '700',
                color: '#111827',
                marginTop: '20px',
                marginBottom: '8px',
              }}>
                {statusInfo.label}
              </h3>

              <p style={{
                fontSize: '15px',
                color: '#6b7280',
                marginBottom: '20px',
              }}>
                {statusInfo.description}
              </p>

              {/* Amount (for approved) */}
              {status === 'approved' && order?.amount && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  marginBottom: '20px',
                }}>
                  <p style={{
                    fontSize: '14px',
                    color: '#15803d',
                    marginBottom: '4px',
                  }}>
                    Added to your wallet
                  </p>
                  <p style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: '#16a34a',
                  }}>
                    + PHP {formatPrice(order.amount)}
                  </p>
                </div>
              )}

              {/* Error Details (for rejected) */}
              {status === 'rejected' && submission?.validationErrors?.length > 0 && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  marginBottom: '20px',
                  textAlign: 'left',
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                  }}>
                    <AlertCircle style={{ width: '18px', height: '18px', color: '#dc2626' }} />
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#dc2626',
                      margin: 0,
                    }}>
                      Why it failed:
                    </p>
                  </div>
                  <ul style={{
                    fontSize: '13px',
                    color: '#991b1b',
                    margin: 0,
                    paddingLeft: '24px',
                    lineHeight: '1.6',
                  }}>
                    {submission.validationErrors.slice(0, 3).map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Manual Review Info */}
              {status === 'manual_review' && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  marginBottom: '20px',
                }}>
                  <p style={{
                    fontSize: '14px',
                    color: '#92400e',
                    margin: 0,
                  }}>
                    Our team is reviewing your payment. This usually takes 5-10 minutes.
                    You'll receive a notification when complete.
                  </p>
                </div>
              )}

              {/* Processing Info */}
              {(status === 'pending' || status === 'processing') && (
                <div style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  marginBottom: '20px',
                }}>
                  <p style={{
                    fontSize: '14px',
                    color: '#1e40af',
                    margin: 0,
                  }}>
                    We're analyzing your screenshot using OCR. This usually takes 10-30 seconds.
                  </p>
                </div>
              )}

              {/* OCR Details (optional debug info) */}
              {submission?.extractedData?.amount && status !== 'approved' && (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#f9fafb',
                  marginBottom: '20px',
                  textAlign: 'left',
                  fontSize: '12px',
                  color: '#6b7280',
                }}>
                  <p style={{ margin: '0 0 4px' }}>
                    <strong>Detected Amount:</strong> PHP {formatPrice(submission.extractedData.amount)}
                  </p>
                  {submission.extractedData.referenceNumber && (
                    <p style={{ margin: '0 0 4px' }}>
                      <strong>Ref #:</strong> {submission.extractedData.referenceNumber}
                    </p>
                  )}
                  <p style={{ margin: 0 }}>
                    <strong>Confidence:</strong> {submission.extractedData.confidence || 0}%
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* View Wallet (approved) */}
          {status === 'approved' && (
            <button
              onClick={() => {
                onViewWallet?.();
                handleClose();
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(to right, #22c55e, #16a34a)',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              <Wallet style={{ width: '18px', height: '18px' }} />
              View Wallet
            </button>
          )}

          {/* Try Again (rejected) */}
          {status === 'rejected' && (
            <button
              onClick={() => {
                onRetry?.();
                handleClose();
              }}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              }}
            >
              <RefreshCw style={{ width: '18px', height: '18px' }} />
              Try Again
            </button>
          )}

          {/* Close Button */}
          <Button
            variant="ghost"
            onClick={handleClose}
            style={{ width: '100%' }}
          >
            {status === 'approved' || status === 'rejected' ? 'Close' : 'Check Later'}
          </Button>
        </div>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}

export default PaymentStatusModal;
