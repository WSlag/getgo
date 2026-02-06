import React, { useState } from 'react';
import {
  Wallet,
  CreditCard,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  Receipt,
  MapPin,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function PlatformFeeModal({
  open,
  onClose,
  data,
  walletBalance = 0,
  onPaymentComplete,
  onTopUp,
  loading = false,
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  if (!data) return null;

  const { bid, listing, platformFee } = data;
  const agreedPrice = bid?.price || 0;
  const hasEnoughBalance = walletBalance >= platformFee;

  const formatPrice = (price) => {
    if (!price) return '₱0';
    return `₱${Number(price).toLocaleString()}`;
  };

  const handlePay = async () => {
    if (!hasEnoughBalance) return;

    setPaying(true);
    setError(null);

    try {
      await onPaymentComplete?.(bid.id, platformFee);
    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
      setPaying(false);
    }
  };

  const handleClose = () => {
    if (!paying) {
      setError(null);
      onClose?.();
    }
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
              <DialogTitle style={{ fontSize: '20px' }}>Platform Service Fee</DialogTitle>
              <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
                Pay to generate your contract
              </p>
            </div>
          </div>
        </DialogHeader>

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

        {/* Wallet Balance */}
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          border: hasEnoughBalance ? '1px solid #bbf7d0' : '1px solid #fecaca',
          backgroundColor: hasEnoughBalance ? '#f0fdf4' : '#fef2f2',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet style={{ width: '20px', height: '20px', color: hasEnoughBalance ? '#16a34a' : '#dc2626' }} />
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>Your Wallet</span>
            </div>
            <span style={{ fontSize: '18px', fontWeight: '700', color: hasEnoughBalance ? '#16a34a' : '#dc2626' }}>
              {formatPrice(walletBalance)}
            </span>
          </div>

          {hasEnoughBalance ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#15803d' }}>
              <CheckCircle2 style={{ width: '16px', height: '16px' }} />
              <span>Sufficient balance</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '14px', color: '#dc2626' }}>
                <AlertCircle style={{ width: '16px', height: '16px', marginTop: '2px', flexShrink: 0 }} />
                <span>
                  Insufficient balance. You need {formatPrice(platformFee - walletBalance)} more.
                </span>
              </div>
              <button
                onClick={onTopUp}
                style={{
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  border: '1px solid #fca5a5',
                  backgroundColor: 'white',
                  color: '#dc2626',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <Wallet style={{ width: '16px', height: '16px' }} />
                Top Up Wallet
              </button>
            </div>
          )}
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
                <li style={{ marginBottom: '4px' }}>Contract will be generated with agreed terms</li>
                <li style={{ marginBottom: '4px' }}>Both parties review and sign the contract</li>
                <li>Shipment tracking begins after signatures</li>
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
          <Button variant="ghost" onClick={handleClose} disabled={paying} style={{ flex: 1 }}>
            Cancel
          </Button>
          <button
            onClick={handlePay}
            disabled={paying || loading || !hasEnoughBalance}
            style={{
              flex: 1,
              padding: '12px 20px',
              borderRadius: '10px',
              border: 'none',
              background: (paying || loading || !hasEnoughBalance)
                ? '#d1d5db'
                : 'linear-gradient(to right, #fb923c, #ea580c)',
              color: 'white',
              fontSize: '14px',
              fontWeight: '600',
              cursor: (paying || loading || !hasEnoughBalance) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: (paying || loading || !hasEnoughBalance) ? 0.6 : 1,
            }}
          >
            {paying || loading ? (
              <>
                <Loader2 style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} />
                Processing...
              </>
            ) : (
              <>
                <CreditCard style={{ width: '16px', height: '16px' }} />
                Pay {formatPrice(platformFee)}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PlatformFeeModal;
