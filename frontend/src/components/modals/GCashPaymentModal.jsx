import React, { useState, useRef, useEffect } from 'react';
import {
  Wallet,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Receipt,
  MapPin,
  QrCode,
  Upload,
  Camera,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { uploadPaymentScreenshot, createPaymentSubmission } from '@/services/firestoreService';
import { useOrderSubmission } from '@/hooks/usePaymentSubmission';
import api from '@/services/api';

/**
 * GCashPaymentModal - Multi-step platform fee payment via GCash QR
 *
 * Steps:
 * 1. info - Show fee breakdown and route info
 * 2. qr - Display GCash QR code and payment instructions
 * 3. upload - Screenshot upload interface
 * 4. status - Real-time verification status
 */
export function GCashPaymentModal({
  open,
  onClose,
  data,
  onContractCreated,
}) {
  const [step, setStep] = useState('info'); // 'info' | 'qr' | 'upload' | 'status'
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Upload state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Watch payment submission status
  const { submission, loading: submissionLoading } = useOrderSubmission(order?.orderId);

  const { bid, listing, platformFee } = data || {};
  const agreedPrice = bid?.price || 0;

  const formatPrice = (price) => {
    if (!price) return '₱0';
    return `₱${Number(price).toLocaleString()}`;
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setStep('info');
      setOrder(null);
      setError(null);
      clearFile();
    }
  }, [open]);

  // Watch for payment approval and return control to parent
  useEffect(() => {
    if (submission?.status === 'approved' && order) {
      // Payment is recorded server-side; notify parent
      setTimeout(() => {
        onContractCreated?.({ bidId: bid.id });
        handleClose();
      }, 2000);
    }
  }, [submission?.status, order]);

  const clearFile = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCreateOrder = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await api.wallet.createPlatformFeeOrder({ bidId: bid.id });
      setOrder(result.order);
      setStep('qr');
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err.message || 'Failed to create payment order');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setError('Please upload a JPG, PNG, or WebP image');
      return;
    }

    // Validate file size (5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setError(null);
  };

  const handleUpload = async () => {
    if (!file || !order) return;

    setUploading(true);
    setError(null);

    try {
      const screenshotUrl = await uploadPaymentScreenshot(order.orderId, file);
      await createPaymentSubmission({
        orderId: order.orderId,
        bidId: bid.id, // Link to bid for platform fee tracking
        screenshotUrl,
      });

      setStep('status');
      clearFile();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRetry = () => {
    setStep('qr');
    setError(null);
    clearFile();
  };

  const handleClose = () => {
    if (loading || uploading) return;
    onClose?.();
  };

  const renderInfoStep = () => (
    <>
      {/* Route Summary */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin style={{ width: '16px', height: '16px', color: '#22c55e' }} />
          <span style={{ fontSize: '14px', color: '#6b7280' }}>Route</span>
        </div>
        <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
          {listing?.origin} → {listing?.destination}
        </span>
      </div>

      {/* Fee Breakdown */}
      <div style={{
        padding: '16px',
        borderRadius: '12px',
        backgroundColor: '#f9fafb',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Agreed Freight Rate</span>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
              {formatPrice(agreedPrice)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#6b7280' }}>Platform Fee (5%)</span>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
              {formatPrice(platformFee)}
            </span>
          </div>
          <div style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '12px',
            marginTop: '4px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: '#111827' }}>Amount to Pay</span>
              <span style={{ fontSize: '24px', fontWeight: '700', color: '#16a34a' }}>
                {formatPrice(platformFee)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* What happens next */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <FileText style={{ width: '18px', height: '18px', color: '#2563eb', marginTop: '2px', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#1d4ed8', marginBottom: '6px' }}>
              What happens after payment:
            </p>
            <ol style={{ fontSize: '12px', color: '#1e40af', margin: 0, paddingLeft: '16px' }}>
              <li style={{ marginBottom: '4px' }}>Scan QR code and pay via GCash</li>
              <li style={{ marginBottom: '4px' }}>Upload your payment screenshot</li>
              <li style={{ marginBottom: '4px' }}>Automatic verification (takes 10-30 seconds)</li>
              <li>Contract generated for both parties to sign</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#dc2626',
        }}>
          <AlertCircle style={{ width: '16px', height: '16px' }} />
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
        <Button variant="ghost" onClick={handleClose} disabled={loading} style={{ flex: 1 }}>
          Cancel
        </Button>
        <button
          onClick={handleCreateOrder}
          disabled={loading}
          style={{
            flex: 1,
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            background: loading ? '#d1d5db' : 'linear-gradient(to right, #fb923c, #ea580c)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <>
              <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              Loading...
            </>
          ) : (
            <>
              Pay via GCash
              <ArrowRight style={{ width: '16px', height: '16px' }} />
            </>
          )}
        </button>
      </div>
    </>
  );

  const renderQRStep = () => (
    <>
      {/* QR Code Display */}
      <div style={{
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: '#f9fafb',
        textAlign: 'center',
      }}>
        {order?.gcashQrUrl ? (
          <img
            src={order.gcashQrUrl}
            alt="GCash QR Code"
            style={{
              maxWidth: '200px',
              maxHeight: '200px',
              margin: '0 auto 16px',
              borderRadius: '8px',
            }}
          />
        ) : (
          <div style={{
            width: '200px',
            height: '200px',
            margin: '0 auto 16px',
            borderRadius: '8px',
            backgroundColor: '#e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <QrCode style={{ width: '80px', height: '80px', color: '#9ca3af' }} />
          </div>
        )}

        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Send to</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '2px' }}>
            {order?.gcashAccountName}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {order?.gcashAccountNumber}
          </div>
        </div>

        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          backgroundColor: '#dcfce7',
          border: '1px solid #86efac',
        }}>
          <div style={{ fontSize: '12px', color: '#15803d', marginBottom: '4px' }}>Amount to Send</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>
            {formatPrice(order?.amount)}
          </div>
        </div>

        {order?.expiresInMinutes && (
          <div style={{
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '13px',
            color: '#f59e0b',
          }}>
            <Clock style={{ width: '14px', height: '14px' }} />
            Expires in {order.expiresInMinutes} minutes
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: '#eff6ff',
        border: '1px solid #bfdbfe',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1d4ed8', marginBottom: '8px' }}>
          📱 Payment Instructions:
        </div>
        <ol style={{ fontSize: '12px', color: '#1e40af', margin: 0, paddingLeft: '16px' }}>
          <li style={{ marginBottom: '6px' }}>Open your GCash app</li>
          <li style={{ marginBottom: '6px' }}>Scan the QR code above or send to {order?.gcashAccountNumber}</li>
          <li style={{ marginBottom: '6px' }}>Send exactly {formatPrice(order?.amount)}</li>
          <li>Take a screenshot of the successful transaction</li>
        </ol>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#dc2626',
        }}>
          <AlertCircle style={{ width: '16px', height: '16px' }} />
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
        <Button variant="ghost" onClick={() => setStep('info')} disabled={loading} style={{ flex: 1 }}>
          Back
        </Button>
        <button
          onClick={() => setStep('upload')}
          style={{
            flex: 2,
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            background: 'linear-gradient(to right, #22c55e, #16a34a)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <Camera style={{ width: '16px', height: '16px' }} />
          I've Paid, Upload Screenshot
        </button>
      </div>
    </>
  );

  const renderUploadStep = () => (
    <>
      {/* Upload Area */}
      <div style={{
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: '#f9fafb',
        border: '2px dashed #d1d5db',
      }}>
        {preview ? (
          <div style={{ position: 'relative' }}>
            <img
              src={preview}
              alt="Screenshot preview"
              style={{
                width: '100%',
                maxHeight: '300px',
                objectFit: 'contain',
                borderRadius: '8px',
              }}
            />
            <button
              onClick={clearFile}
              disabled={uploading}
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X style={{ width: '18px', height: '18px' }} />
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <Upload style={{ width: '48px', height: '48px', color: '#9ca3af', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>
              Upload GCash Screenshot
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
              JPG, PNG, or WebP (max 5MB)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              disabled={uploading}
              style={{ display: 'none' }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{
                padding: '10px 20px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                color: '#111827',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Choose File
            </button>
          </div>
        )}
      </div>

      {/* Screenshot Requirements */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '12px',
        backgroundColor: '#fef3c7',
        border: '1px solid #fcd34d',
      }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
          ✓ Make sure your screenshot shows:
        </div>
        <ul style={{ fontSize: '12px', color: '#78350f', margin: 0, paddingLeft: '20px' }}>
          <li style={{ marginBottom: '4px' }}>Reference number clearly visible</li>
          <li style={{ marginBottom: '4px' }}>Amount matches {formatPrice(order?.amount)}</li>
          <li style={{ marginBottom: '4px' }}>Receiver name: {order?.gcashAccountName}</li>
          <li>Transaction timestamp (recent)</li>
        </ul>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: '#dc2626',
        }}>
          <AlertCircle style={{ width: '16px', height: '16px' }} />
          {error}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
        <Button variant="ghost" onClick={() => setStep('qr')} disabled={uploading} style={{ flex: 1 }}>
          Back
        </Button>
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          style={{
            flex: 2,
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            background: (uploading || !file) ? '#d1d5db' : 'linear-gradient(to right, #3b82f6, #2563eb)',
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            cursor: (uploading || !file) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            opacity: (uploading || !file) ? 0.6 : 1,
          }}
        >
          {uploading ? (
            <>
              <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
              Uploading...
            </>
          ) : (
            <>
              <Upload style={{ width: '16px', height: '16px' }} />
              Upload Screenshot
            </>
          )}
        </button>
      </div>
    </>
  );

  const renderStatusStep = () => {
    const status = submission?.status || 'pending';
    const getStatusInfo = () => {
      switch (status) {
        case 'pending':
        case 'processing':
          return {
            icon: <Loader2 style={{ width: '48px', height: '48px', color: '#3b82f6', animation: 'spin 1s linear infinite' }} />,
            title: 'Verifying Payment',
            message: 'Please wait while we verify your GCash screenshot. This usually takes 10-30 seconds...',
            color: '#3b82f6',
          };
        case 'approved':
          return {
            icon: <CheckCircle2 style={{ width: '48px', height: '48px', color: '#22c55e' }} />,
            title: 'Payment Verified!',
            message: 'Your payment has been approved and your platform fee is now recorded. You will be redirected shortly.',
            color: '#22c55e',
          };
        case 'rejected':
          return {
            icon: <AlertCircle style={{ width: '48px', height: '48px', color: '#ef4444' }} />,
            title: 'Verification Failed',
            message: 'Your payment could not be verified. Please try again with a clear screenshot.',
            color: '#ef4444',
          };
        case 'manual_review':
          return {
            icon: <Clock style={{ width: '48px', height: '48px', color: '#f59e0b' }} />,
            title: 'Pending Admin Review',
            message: 'Your payment is being reviewed by our team. This usually takes 5-10 minutes. You\'ll be notified once approved.',
            color: '#f59e0b',
          };
        default:
          return {
            icon: <Loader2 style={{ width: '48px', height: '48px', color: '#9ca3af', animation: 'spin 1s linear infinite' }} />,
            title: 'Processing',
            message: 'Processing your payment...',
            color: '#9ca3af',
          };
      }
    };

    const statusInfo = getStatusInfo();

    return (
      <>
        <div style={{ textAlign: 'center', padding: '32px 16px' }}>
          <div style={{ marginBottom: '20px' }}>
            {statusInfo.icon}
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            {statusInfo.title}
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: '1.5' }}>
            {statusInfo.message}
          </p>

          {submission?.validationErrors && submission.validationErrors.length > 0 && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: '#dc2626', marginBottom: '6px' }}>
                Issues found:
              </div>
              <ul style={{ fontSize: '12px', color: '#dc2626', margin: 0, paddingLeft: '20px' }}>
                {submission.validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ paddingTop: '8px' }}>
          {status === 'rejected' ? (
            <button
              onClick={handleRetry}
              style={{
                width: '100%',
                padding: '12px 20px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(to right, #3b82f6, #2563eb)',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          ) : status === 'manual_review' ? (
            <Button variant="ghost" onClick={handleClose} style={{ width: '100%' }}>
              Close
            </Button>
          ) : null}
        </div>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md backdrop-blur-sm">
        <DialogHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(to bottom right, #4ade80, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.3)',
            }}>
              <Receipt style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
            <div>
              <DialogTitle style={{ fontSize: '20px' }}>
                {step === 'info' && 'Platform Service Fee'}
                {step === 'qr' && 'Scan & Pay'}
                {step === 'upload' && 'Upload Screenshot'}
                {step === 'status' && 'Verification Status'}
              </DialogTitle>
              <DialogDescription style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
                {step === 'info' && 'Pay via GCash to generate contract'}
                {step === 'qr' && 'Send payment via GCash'}
                {step === 'upload' && 'Upload your payment receipt'}
                {step === 'status' && 'Payment verification in progress'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === 'info' && renderInfoStep()}
        {step === 'qr' && renderQRStep()}
        {step === 'upload' && renderUploadStep()}
        {step === 'status' && renderStatusStep()}
      </DialogContent>
    </Dialog>
  );
}

export default GCashPaymentModal;
