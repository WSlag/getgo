import React, { useState, useRef } from 'react';
import {
  Upload,
  Image,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Camera,
  FileImage
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  uploadPaymentScreenshot,
  createPaymentSubmission
} from '@/services/firestoreService';
import api from '@/services/api';

const ORDER_ACCEPTING_UPLOAD_STATUSES = new Set(['awaiting_upload', 'processing']);

export function PaymentUploadModal({
  open,
  onClose,
  order,
  onUploadComplete,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef(null);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '0';
    return Number(price).toLocaleString();
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

    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setError(null);
  };

  const clearFile = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!file || !order) return;

    setUploading(true);
    setError(null);

    try {
      // 1. Upload screenshot to Firebase Storage
      const screenshotUrl = await uploadPaymentScreenshot(order.orderId, file);

      // 2. Create payment submission using callable, with Firestore fallback
      let submission = null;
      try {
        const submissionResponse = await api.wallet.submitPaymentSubmission({
          orderId: order.orderId,
          screenshotUrl,
          bidId: order?.bidId || null,
        });
        submission = submissionResponse?.submission || null;
      } catch (submissionError) {
        const code = String(submissionError?.code || '').toLowerCase();
        const message = String(submissionError?.message || '').toLowerCase();
        const callableMissing =
          code.includes('unimplemented') ||
          code.includes('not-found') ||
          message.includes('function not found') ||
          message.includes('does not exist');

        if (!callableMissing) {
          throw submissionError;
        }

        submission = await createPaymentSubmission({
          orderId: order.orderId,
          screenshotUrl,
          bidId: order?.bidId || null,
        });
      }

      setSuccess(true);

      // 3. Notify parent component after short delay
      setTimeout(() => {
        onUploadComplete?.(order.orderId, submission?.id || null);
      }, 1000);

    } catch (err) {
      console.error('Upload error:', err);
      const code = String(err?.code || '').toLowerCase();
      const message = String(err?.message || '').toLowerCase();
      const isPermissionError =
        code.includes('permission-denied') ||
        message.includes('missing or insufficient permissions');
      const isInactiveOrderError =
        code.includes('failed-precondition') && (
          message.includes('order has expired') ||
          message.includes('not accepting uploads')
        );

      if (isPermissionError || isInactiveOrderError) {
        let latestOrderStatus = null;
        try {
          const orderLookup = await api.wallet.getOrder(order.orderId);
          latestOrderStatus = orderLookup?.order?.status || null;
        } catch {
          // Ignore lookup errors and show generic permission message.
        }

        if (latestOrderStatus && !ORDER_ACCEPTING_UPLOAD_STATUSES.has(String(latestOrderStatus))) {
          setError('This payment request is no longer active. Please create a new one and upload again.');
        } else if (isInactiveOrderError) {
          setError('This payment request expired or was closed. Please create a fresh payment request.');
        } else {
          setError('Payment upload was blocked by permissions. Please retry in your default browser.');
        }
      } else {
        setError(err.message || 'Upload failed. Please try again.');
      }
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    clearFile();
    setSuccess(false);
    onClose?.();
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
              background: 'linear-gradient(to bottom right, #3b82f6, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 15px -3px rgba(59, 130, 246, 0.3)',
            }}>
              <Camera style={{ width: '24px', height: '24px', color: 'white' }} />
            </div>
            <div>
              <DialogTitle style={{ fontSize: '20px' }}>Upload Screenshot</DialogTitle>
              <DialogDescription style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
                GCash payment receipt
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Success State */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'linear-gradient(to bottom right, #22c55e, #16a34a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 10px 25px -5px rgba(34, 197, 94, 0.4)',
            }}>
              <CheckCircle2 style={{ width: '40px', height: '40px', color: 'white' }} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
              Screenshot Uploaded!
            </h3>
            <p style={{ fontSize: '14px', color: '#6b7280' }}>
              We're verifying your payment...
            </p>
          </div>
        ) : (
          <>
            {/* Instructions */}
            <div style={{
              padding: '16px',
              borderRadius: '12px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
            }}>
              <h4 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#1e40af',
                marginBottom: '8px',
              }}>
                Screenshot Requirements
              </h4>
              <ul style={{
                fontSize: '13px',
                color: '#1e40af',
                margin: 0,
                paddingLeft: '20px',
                lineHeight: '1.6',
              }}>
                <li>Reference number must be visible</li>
                <li>Amount must match: <strong>PHP {formatPrice(order?.amount)}</strong></li>
                <li>Transaction date/time must be clear</li>
              </ul>
            </div>

            {/* Upload Area */}
            <div
              onClick={() => !uploading && fileInputRef.current?.click()}
              style={{
                border: preview ? '2px solid #22c55e' : '2px dashed #d1d5db',
                borderRadius: '16px',
                padding: preview ? '12px' : '32px',
                textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                background: preview ? '#f0fdf4' : '#f9fafb',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              {preview ? (
                <div style={{ position: 'relative' }}>
                  <img
                    src={preview}
                    alt="Screenshot preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '240px',
                      borderRadius: '12px',
                      objectFit: 'contain',
                    }}
                  />
                  {!uploading && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        clearFile();
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'rgba(0, 0, 0, 0.6)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X style={{ width: '18px', height: '18px' }} />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}>
                    <FileImage style={{ width: '28px', height: '28px', color: '#9ca3af' }} />
                  </div>
                  <p style={{
                    fontSize: '15px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '4px',
                  }}>
                    Tap to upload screenshot
                  </p>
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                    JPG, PNG, or WebP (max 5MB)
                  </p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {/* Error Message */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
              }}>
                <AlertCircle style={{ width: '18px', height: '18px', color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '14px', color: '#dc2626', margin: 0 }}>{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              style={{
                width: '100%',
                padding: '14px 20px',
                borderRadius: '12px',
                border: 'none',
                background: (!file || uploading)
                  ? '#d1d5db'
                  : 'linear-gradient(to right, #22c55e, #16a34a)',
                color: 'white',
                fontSize: '15px',
                fontWeight: '600',
                cursor: (!file || uploading) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: (!file || uploading) ? 0.7 : 1,
                boxShadow: (!file || uploading)
                  ? 'none'
                  : '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              {uploading ? (
                <>
                  <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload style={{ width: '18px', height: '18px' }} />
                  Verify Payment
                </>
              )}
            </button>
          </>
        )}

        {/* Footer */}
        {!success && (
          <div style={{ paddingTop: '8px' }}>
            <Button variant="ghost" onClick={handleClose} style={{ width: '100%' }} disabled={uploading}>
              Cancel
            </Button>
          </div>
        )}
      </DialogContent>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Dialog>
  );
}

export default PaymentUploadModal;
