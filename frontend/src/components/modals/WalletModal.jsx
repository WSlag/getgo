import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  RotateCcw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Building2,
  Store,
  QrCode,
  Camera,
  ChevronLeft,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '@/services/api';
import { PaymentUploadModal } from './PaymentUploadModal';
import { PaymentStatusModal } from './PaymentStatusModal';

const paymentMethods = [
  { id: 'gcash', name: 'GCash', fee: 0, icon: CreditCard, hasScreenshot: true },
  { id: 'maya', name: 'Maya', fee: 0, icon: CreditCard, hasScreenshot: false },
  { id: 'grabpay', name: 'GrabPay', fee: 0, icon: CreditCard, hasScreenshot: false },
  { id: 'bank', name: 'Bank Transfer', fee: 0, icon: Building2, hasScreenshot: false },
  { id: 'seveneleven', name: '7-Eleven', fee: 15, icon: Store, hasScreenshot: false },
  { id: 'cebuana', name: 'Cebuana', fee: 25, icon: Store, hasScreenshot: false },
];

const quickAmounts = [500, 1000, 2000, 5000];

// GCash QR code placeholder - replace with your actual QR code URL
const GCASH_QR_URL = import.meta.env.VITE_GCASH_QR_URL || null;

export function WalletModal({
  open,
  onClose,
  walletBalance = 0,
  transactions = [],
  loading = false,
  onTopUp,
  onPayout,
}) {
  const [activeTab, setActiveTab] = useState('topup');
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('gcash');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // GCash Screenshot Flow States
  const [gcashStep, setGcashStep] = useState('amount'); // 'amount' | 'qr' | 'upload' | 'status'
  const [currentOrder, setCurrentOrder] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '₱0';
    return `₱${Math.abs(Number(price)).toLocaleString()}`;
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'topup': return ArrowDownLeft;
      case 'payout': return ArrowUpRight;
      case 'fee': return Receipt;
      case 'refund': return RotateCcw;
      default: return Receipt;
    }
  };

  const getTransactionStyles = (type) => {
    switch (type) {
      case 'topup': return { color: '#22c55e', bg: '#f0fdf4' };
      case 'payout': return { color: '#3b82f6', bg: '#eff6ff' };
      case 'fee': return { color: '#f97316', bg: '#fff7ed' };
      case 'refund': return { color: '#a855f7', bg: '#faf5ff' };
      default: return { color: '#6b7280', bg: '#f9fafb' };
    }
  };

  const selectedPaymentMethod = paymentMethods.find((m) => m.id === selectedMethod);
  const processingFee = selectedPaymentMethod?.fee || 0;
  const numericAmount = parseFloat(amount) || 0;

  // Handle Top Up button click
  const handleTopUpClick = async () => {
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    // If GCash is selected, use screenshot verification flow
    if (selectedMethod === 'gcash') {
      await startGcashFlow();
    } else {
      // Use existing mock flow for other methods
      await handleLegacyTopUp();
    }
  };

  // Start GCash Screenshot Verification Flow
  const startGcashFlow = async () => {
    setProcessing(true);
    setError(null);

    try {
      // Create order via backend API
      const response = await api.wallet.createTopUpOrder({
        amount: numericAmount,
        method: 'gcash',
      });

      if (response.success && response.order) {
        setCurrentOrder(response.order);
        setGcashStep('qr');
      } else {
        throw new Error(response.error || 'Failed to create order');
      }
    } catch (err) {
      console.error('Create order error:', err);
      setError(err.message || 'Failed to start payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Handle legacy top-up for non-GCash methods
  const handleLegacyTopUp = async () => {
    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      await onTopUp?.(numericAmount, selectedMethod);
      setSuccess(`Successfully topped up ${formatPrice(numericAmount)}`);
      setAmount('');
      setTimeout(() => setActiveTab('history'), 1500);
    } catch (err) {
      setError(err.message || 'Transaction failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  // Handle "I've Paid" button
  const handlePaidClick = () => {
    setShowUploadModal(true);
  };

  // Handle screenshot upload complete
  const handleUploadComplete = (orderId, submissionId) => {
    setShowUploadModal(false);
    setShowStatusModal(true);
  };

  // Handle status modal close
  const handleStatusClose = () => {
    setShowStatusModal(false);
    // Reset GCash flow
    setGcashStep('amount');
    setCurrentOrder(null);
    setAmount('');
  };

  // Handle retry from status modal
  const handleRetry = () => {
    setShowStatusModal(false);
    setGcashStep('qr');
  };

  // Handle view wallet from status modal
  const handleViewWallet = () => {
    setShowStatusModal(false);
    setGcashStep('amount');
    setCurrentOrder(null);
    setAmount('');
    setActiveTab('history');
  };

  // Go back from QR step
  const handleBackFromQr = () => {
    setGcashStep('amount');
    setCurrentOrder(null);
  };

  // Handle payout submit
  const handlePayoutSubmit = async () => {
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (numericAmount > walletBalance) {
      setError('Insufficient balance');
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      await onPayout?.(numericAmount, selectedMethod);
      setSuccess(`Payout of ${formatPrice(numericAmount)} initiated`);
      setAmount('');
      setTimeout(() => setActiveTab('history'), 1500);
    } catch (err) {
      setError(err.message || 'Transaction failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    if (!processing) {
      setActiveTab('topup');
      setAmount('');
      setError(null);
      setSuccess(null);
      setGcashStep('amount');
      setCurrentOrder(null);
      setShowUploadModal(false);
      setShowStatusModal(false);
      onClose?.();
    }
  };

  // Render GCash QR Code Step
  const renderGcashQrStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Back Button */}
      <button
        onClick={handleBackFromQr}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px 12px',
          borderRadius: '8px',
          border: 'none',
          background: '#f3f4f6',
          color: '#374151',
          fontSize: '14px',
          cursor: 'pointer',
          alignSelf: 'flex-start',
        }}
      >
        <ChevronLeft style={{ width: '16px', height: '16px' }} />
        Back
      </button>

      {/* QR Code Display */}
      <div style={{
        padding: '24px',
        borderRadius: '16px',
        background: 'white',
        border: '2px solid #22c55e',
        textAlign: 'center',
      }}>
        {GCASH_QR_URL || currentOrder?.gcashQrUrl ? (
          <img
            src={GCASH_QR_URL || currentOrder?.gcashQrUrl}
            alt="GCash QR Code"
            style={{
              width: '200px',
              height: '200px',
              margin: '0 auto 16px',
              borderRadius: '12px',
            }}
          />
        ) : (
          <div style={{
            width: '200px',
            height: '200px',
            margin: '0 auto 16px',
            background: '#f3f4f6',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <QrCode style={{ width: '80px', height: '80px', color: '#9ca3af' }} />
          </div>
        )}

        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '8px' }}>
          Scan to pay via GCash
        </p>

        <div style={{
          padding: '12px 16px',
          borderRadius: '12px',
          background: '#f0fdf4',
          marginTop: '12px',
        }}>
          <p style={{ fontSize: '13px', color: '#15803d', marginBottom: '4px' }}>
            Pay exactly:
          </p>
          <p style={{ fontSize: '28px', fontWeight: '700', color: '#16a34a' }}>
            {formatPrice(currentOrder?.amount || numericAmount)}
          </p>
          <p style={{ fontSize: '13px', color: '#15803d', marginTop: '4px' }}>
            To: <strong>{currentOrder?.gcashAccountName || 'KARGA CONNECT'}</strong>
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        padding: '16px',
        borderRadius: '12px',
        background: '#fef3c7',
        border: '1px solid #fde68a',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
          <AlertCircle style={{ width: '18px', height: '18px', color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <p style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '6px' }}>
              Important
            </p>
            <ul style={{
              fontSize: '13px',
              color: '#92400e',
              margin: 0,
              paddingLeft: '16px',
              lineHeight: '1.5',
            }}>
              <li>Amount must match exactly</li>
              <li>Take a screenshot after payment</li>
              <li>Screenshot must show reference number</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Expiry Timer */}
      {currentOrder?.expiresAt && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px',
          borderRadius: '8px',
          background: '#f3f4f6',
        }}>
          <Clock style={{ width: '14px', height: '14px', color: '#6b7280' }} />
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            Expires in 30 minutes
          </p>
        </div>
      )}

      {/* I've Paid Button */}
      <button
        onClick={handlePaidClick}
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
        <Camera style={{ width: '18px', height: '18px' }} />
        I've Paid - Upload Screenshot
      </button>
    </div>
  );

  return (
    <>
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
                <Wallet style={{ width: '24px', height: '24px', color: 'white' }} />
              </div>
              <div>
                <DialogTitle style={{ fontSize: '20px' }}>My Wallet</DialogTitle>
                <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
                  Manage your funds
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Balance Card */}
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(to bottom right, #22c55e, #16a34a)',
            color: 'white',
          }}>
            <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '4px' }}>Current Balance</p>
            <p style={{ fontSize: '32px', fontWeight: '700' }}>{formatPrice(walletBalance)}</p>
          </div>

          {/* Tab Buttons - Hide during GCash QR step */}
          {gcashStep === 'amount' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { id: 'topup', label: 'Top Up', color: '#22c55e' },
                { id: 'payout', label: 'Payout', color: '#3b82f6' },
                { id: 'history', label: 'History', color: '#111827' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setError(null);
                    setSuccess(null);
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: 'none',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: activeTab === tab.id ? tab.color : '#f3f4f6',
                    color: activeTab === tab.id ? 'white' : '#374151',
                    boxShadow: activeTab === tab.id ? `0 4px 12px ${tab.color}40` : 'none',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          {/* Content Area */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {/* GCash QR Step */}
            {activeTab === 'topup' && gcashStep === 'qr' && renderGcashQrStep()}

            {/* Top Up Form */}
            {activeTab === 'topup' && gcashStep === 'amount' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Amount Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Amount
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '18px',
                      fontWeight: '500',
                    }}>
                      ₱
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '14px 16px 14px 36px',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        fontSize: '18px',
                        fontWeight: '600',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {/* Quick amounts */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(amt.toString())}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#f3f4f6',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        ₱{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Pay via
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      const isSelected = selectedMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedMethod(method.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid #22c55e' : '1px solid #e5e7eb',
                            background: isSelected ? '#f0fdf4' : 'white',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <Icon style={{
                            width: '20px',
                            height: '20px',
                            color: isSelected ? '#22c55e' : '#9ca3af',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: isSelected ? '#15803d' : '#374151',
                              margin: 0,
                            }}>
                              {method.name}
                              {method.hasScreenshot && (
                                <span style={{
                                  marginLeft: '6px',
                                  fontSize: '10px',
                                  background: '#dbeafe',
                                  color: '#1d4ed8',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}>
                                  QR
                                </span>
                              )}
                            </p>
                            {method.fee > 0 && (
                              <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>
                                +₱{method.fee} fee
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                {numericAmount > 0 && (
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: '#f9fafb',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px', color: '#6b7280' }}>Amount</span>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{formatPrice(numericAmount)}</span>
                    </div>
                    {processingFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', color: '#6b7280' }}>Processing Fee</span>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{formatPrice(processingFee)}</span>
                      </div>
                    )}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '12px',
                      borderTop: '1px solid #e5e7eb',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        Total to Pay
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#16a34a' }}>
                        {formatPrice(numericAmount + processingFee)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '14px',
                  }}>
                    <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#16a34a',
                    fontSize: '14px',
                  }}>
                    <CheckCircle2 style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    {success}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleTopUpClick}
                  disabled={processing || !numericAmount}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    border: 'none',
                    background: (processing || !numericAmount)
                      ? '#d1d5db'
                      : 'linear-gradient(to right, #22c55e, #16a34a)',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: (processing || !numericAmount) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: (processing || !numericAmount) ? 0.6 : 1,
                  }}
                >
                  {processing ? (
                    <>
                      <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : selectedMethod === 'gcash' ? (
                    <>
                      <QrCode style={{ width: '18px', height: '18px' }} />
                      Continue to Payment
                    </>
                  ) : (
                    <>
                      <ArrowDownLeft style={{ width: '18px', height: '18px' }} />
                      Top Up {numericAmount ? formatPrice(numericAmount) : ''}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Payout Form */}
            {activeTab === 'payout' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Amount Input */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Amount
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute',
                      left: '16px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#9ca3af',
                      fontSize: '18px',
                      fontWeight: '500',
                    }}>
                      ₱
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      style={{
                        width: '100%',
                        padding: '14px 16px 14px 36px',
                        borderRadius: '12px',
                        border: '1px solid #e5e7eb',
                        fontSize: '18px',
                        fontWeight: '600',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  {/* Quick amounts */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setAmount(amt.toString())}
                        style={{
                          flex: 1,
                          padding: '8px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#f3f4f6',
                          fontSize: '13px',
                          fontWeight: '500',
                          color: '#374151',
                          cursor: 'pointer',
                        }}
                      >
                        ₱{amt.toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                    Receive via
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      const isSelected = selectedMethod === method.id;
                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedMethod(method.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                            background: isSelected ? '#eff6ff' : 'white',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <Icon style={{
                            width: '20px',
                            height: '20px',
                            color: isSelected ? '#3b82f6' : '#9ca3af',
                          }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '13px',
                              fontWeight: '500',
                              color: isSelected ? '#1d4ed8' : '#374151',
                              margin: 0,
                            }}>
                              {method.name}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Summary */}
                {numericAmount > 0 && (
                  <div style={{
                    padding: '16px',
                    borderRadius: '12px',
                    background: '#f9fafb',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                        You will receive
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: '700', color: '#2563eb' }}>
                        {formatPrice(numericAmount)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Error/Success Messages */}
                {error && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: '14px',
                  }}>
                    <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#16a34a',
                    fontSize: '14px',
                  }}>
                    <CheckCircle2 style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                    {success}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handlePayoutSubmit}
                  disabled={processing || !numericAmount}
                  style={{
                    width: '100%',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    border: 'none',
                    background: (processing || !numericAmount)
                      ? '#d1d5db'
                      : 'linear-gradient(to right, #3b82f6, #2563eb)',
                    color: 'white',
                    fontSize: '15px',
                    fontWeight: '600',
                    cursor: (processing || !numericAmount) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    opacity: (processing || !numericAmount) ? 0.6 : 1,
                  }}
                >
                  {processing ? (
                    <>
                      <Loader2 style={{ width: '18px', height: '18px', animation: 'spin 1s linear infinite' }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight style={{ width: '18px', height: '18px' }} />
                      Request Payout {numericAmount ? formatPrice(numericAmount) : ''}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Transactions List */}
            {activeTab === 'history' && (
              <div>
                {loading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
                    <Loader2 style={{ width: '32px', height: '32px', color: '#22c55e', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : transactions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 0' }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: '#f3f4f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 16px',
                    }}>
                      <Receipt style={{ width: '32px', height: '32px', color: '#9ca3af' }} />
                    </div>
                    <p style={{ fontSize: '15px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                      No transactions yet
                    </p>
                    <p style={{ fontSize: '13px', color: '#9ca3af' }}>
                      Top up your wallet to get started
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {transactions.map((tx) => {
                      const Icon = getTransactionIcon(tx.type);
                      const styles = getTransactionStyles(tx.type);
                      return (
                        <div
                          key={tx.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            borderRadius: '12px',
                            background: '#f9fafb',
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: styles.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Icon style={{ width: '20px', height: '20px', color: styles.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '14px',
                              fontWeight: '500',
                              color: '#111827',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {tx.description || tx.type}
                            </p>
                            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
                              {formatDate(tx.createdAt)}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{
                              fontSize: '15px',
                              fontWeight: '600',
                              color: tx.amount > 0 ? '#16a34a' : '#dc2626',
                              margin: 0,
                            }}>
                              {tx.amount > 0 ? '+' : ''}{formatPrice(tx.amount)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {gcashStep === 'amount' && (
            <div style={{ paddingTop: '8px' }}>
              <Button variant="ghost" onClick={handleClose} style={{ width: '100%' }}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Upload Modal */}
      <PaymentUploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        order={currentOrder}
        onUploadComplete={handleUploadComplete}
      />

      {/* Payment Status Modal */}
      <PaymentStatusModal
        open={showStatusModal}
        onClose={handleStatusClose}
        orderId={currentOrder?.orderId}
        onRetry={handleRetry}
        onViewWallet={handleViewWallet}
      />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}

export default WalletModal;
