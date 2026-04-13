import React, { useState, useEffect } from 'react';
import { Phone, ArrowRight, Shield, Loader2, X, KeyRound, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../shared/Logo';
import { cn } from '@/lib/utils';

const OTP_MAX_RETRIES = 3;
const OTP_COOLDOWN_SECONDS = 30;

/**
 * AuthModal - A modal component for login/signup
 * Used when unauthenticated users try to perform protected actions
 */
export default function AuthModal({ open, onClose, onSuccess, title = 'Sign in to continue', onOpenLegal }) {
  const {
    sendOtp,
    resetOtpSendState,
    verifyOtp,
    requestEmailMagicLink,
    signInWithRecoveryCode,
    authUser,
    userProfile,
    emailMagicLinkEnabled,
  } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'email' | 'recovery'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otpRetryCount, setOtpRetryCount] = useState(0);
  const [otpCooldownEndsAt, setOtpCooldownEndsAt] = useState(null);
  const [otpCooldownRemaining, setOtpCooldownRemaining] = useState(0);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setPhone('');
      setOtp('');
      setEmail('');
      setEmailMessage('');
      setRecoveryCode('');
      setStep('phone');
      setError('');
      setLoading(false);
      setOtpRetryCount(0);
      setOtpCooldownEndsAt(null);
      setOtpCooldownRemaining(0);
    }
  }, [open]);

  useEffect(() => {
    if (!otpCooldownEndsAt) {
      setOtpCooldownRemaining(0);
      return undefined;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((otpCooldownEndsAt - Date.now()) / 1000));
      setOtpCooldownRemaining(remaining);
      if (remaining === 0) {
        setOtpCooldownEndsAt(null);
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [otpCooldownEndsAt]);

  const resetOtpGuard = () => {
    setOtpRetryCount(0);
    setOtpCooldownEndsAt(null);
    setOtpCooldownRemaining(0);
  };

  // Close modal when user is authenticated (authUser exists after OTP verification)
  // For new users: modal closes, App.jsx routes to RegisterScreen
  // For existing users: modal closes, pending action executes
  useEffect(() => {
    if (authUser && open) {
      // Only execute pending action if user has a profile (existing user)
      if (userProfile) {
        onSuccess?.();
      }
      onClose();
    }
  }, [authUser, userProfile, open, onSuccess, onClose]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    await handleSubmitPhoneForOtp();
  };

  const handleSubmitPhoneForOtp = async ({ resetVerifier = false } = {}) => {
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (resetVerifier) {
        resetOtpSendState();
      }

      const result = await sendOtp(phone);

      if (result.success) {
        setFormattedPhone(result.formattedPhone);
        resetOtpGuard();
        setStep('otp');
      } else {
        const fallbackError =
          result.code === 'otp_send_timeout'
            ? 'Verification is taking too long. Please retry.'
            : 'Failed to send OTP. Please try again.';
        setError(result.error || fallbackError);
      }
    } catch {
      setError('Verification is taking too long. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  const handleRetryOtpSend = async () => {
    await handleSubmitPhoneForOtp({ resetVerifier: true });
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();

    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    if (otpCooldownRemaining > 0) {
      setError(`Too many incorrect attempts. Try again in ${otpCooldownRemaining}s.`);
      return;
    }

    setLoading(true);
    setError('');

    const result = await verifyOtp(otp);

    setLoading(false);

    if (!result.success) {
      if (result.code === 'auth/invalid-verification-code') {
        const nextRetryCount = otpRetryCount + 1;
        if (nextRetryCount >= OTP_MAX_RETRIES) {
          setOtpRetryCount(0);
          setOtpCooldownEndsAt(Date.now() + OTP_COOLDOWN_SECONDS * 1000);
          setError(
            `Too many incorrect attempts. Try again in ${OTP_COOLDOWN_SECONDS}s or request a new code.`
          );
          return;
        }

        setOtpRetryCount(nextRetryCount);
        const attemptsLeft = OTP_MAX_RETRIES - nextRetryCount;
        setError(
          `Incorrect code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left before temporary cooldown.`
        );
        return;
      }
      setError(result.error || 'Invalid code. Please try again.');
      return;
    }
    resetOtpGuard();
    // If successful, the useEffect above will handle closing and callback
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(value);
    setError('');
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
    setEmailMessage('');
  };

  const handleSendEmailLink = async (e) => {
    if (e) e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');
    setEmailMessage('');

    const result = await requestEmailMagicLink(email);

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Unable to send email link. Please try again.');
      return;
    }

    setEmailMessage(result.message || 'If an eligible account exists, a sign-in link will be sent.');
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    setError('');
  };

  const handleRecoveryCodeChange = (e) => {
    const value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 14);
    setRecoveryCode(value);
    setError('');
  };

  const handleRecoverySignIn = async (e) => {
    if (e) e.preventDefault();

    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    if (!recoveryCode.trim()) {
      setError('Please enter your recovery code');
      return;
    }

    setLoading(true);
    setError('');

    const result = await signInWithRecoveryCode(phone, recoveryCode);

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Recovery sign-in failed. Please try again.');
    }
  };

  const handleBack = () => {
    resetOtpSendState();
    setStep('phone');
    setOtp('');
    setEmailMessage('');
    setRecoveryCode('');
    resetOtpGuard();
    setError('');
  };

  if (!open) return null;

  return (
    <div
      data-testid="auth-modal"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ padding: '16px' }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        style={{ maxWidth: '420px', borderRadius: '16px' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute z-10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
          style={{ top: '16px', right: '16px', padding: '8px', borderRadius: '8px' }}
        >
          <X style={{ width: '20px', height: '20px' }} />
        </button>

        <div style={{ padding: '32px' }}>
          {/* Logo */}
          <div className="flex justify-center" style={{ marginBottom: '24px' }}>
            <Logo size="default" />
          </div>

          {/* Step Progress */}
          {(() => {
            const progressSteps = ['phone', 'otp', 'register'];
            const normalizedStep = step === 'recovery'
              ? 'otp'
              : (step === 'email' ? 'phone' : step);
            return (
          <div className="flex justify-center gap-2 mb-4">
                {progressSteps.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                      s === normalizedStep
                    ? "w-8 bg-orange-500"
                        : i < progressSteps.indexOf(normalizedStep)
                      ? "w-8 bg-orange-300"
                      : "w-8 bg-gray-200 dark:bg-gray-700"
                )}
              />
            ))}
          </div>
            );
          })()}

          {/* Title */}
          <h2
            className="text-center font-semibold text-gray-900 dark:text-white"
            style={{ fontSize: '20px', marginBottom: '28px' }}
          >
            {title}
          </h2>

          {step === 'phone' ? (
            /* Phone Number Step */
            <form onSubmit={handleSendOtp}>
              <div style={{ marginBottom: '24px' }}>
                <label
                  className="block font-medium text-gray-700 dark:text-gray-300"
                  style={{ fontSize: '14px', marginBottom: '10px' }}
                >
                  Phone Number
                </label>
                <div className="relative">
                  <span
                    className="absolute text-gray-500 dark:text-gray-400 font-medium"
                    style={{ left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}
                  >
                    +63
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="9171234567"
                    className={cn(
                      "w-full border border-gray-200 dark:border-gray-600",
                      "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                      "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                      "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                      "transition-all duration-200"
                    )}
                    style={{
                      padding: '15px 48px 15px 56px',
                      borderRadius: '12px',
                      fontSize: '16px',
                    }}
                    autoFocus
                  />
                  <Phone
                    className="absolute text-orange-400"
                    style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px' }}
                  />
                </div>
                <p
                  className="text-gray-500 dark:text-gray-400"
                  style={{ fontSize: '13px', marginTop: '10px' }}
                >
                  We&apos;ll send a verification code to this number
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '20px' }}
                >
                  <p className="text-red-600 dark:text-red-400" style={{ fontSize: '14px' }}>{error}</p>
                </div>
              )}

              <button
                id="auth-modal-send-otp"
                type="submit"
                disabled={loading || phone.length < 10}
                className={cn(
                  "w-full font-medium flex items-center justify-center transition-all duration-300",
                  phone.length >= 10 && !loading
                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
                style={{ padding: '14px 20px', borderRadius: '12px', gap: '8px', fontSize: '15px' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: '18px', height: '18px' }} />
                    Sending...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight style={{ width: '18px', height: '18px' }} />
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loading || phone.length < 10}
                onClick={handleRetryOtpSend}
                className={cn(
                  "w-full transition-colors",
                  loading || phone.length < 10
                    ? "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "text-gray-500 dark:text-gray-400 hover:text-orange-500"
                )}
                style={{ marginTop: '10px', padding: '10px', fontSize: '14px' }}
              >
                Retry OTP send
              </button>

              <button
                type="button"
                disabled={loading || !emailMagicLinkEnabled}
                onClick={() => { setStep('email'); setError(''); setEmailMessage(''); }}
                className={cn(
                  "w-full transition-colors",
                  emailMagicLinkEnabled
                    ? "text-gray-500 dark:text-gray-400 hover:text-orange-500"
                    : "text-gray-400 dark:text-gray-600 cursor-not-allowed"
                )}
                style={{ marginTop: '12px', padding: '10px', fontSize: '14px' }}
              >
                Use email instead
              </button>

              <button
                type="button"
                onClick={() => { setStep('recovery'); setError(''); }}
                className="w-full text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
                style={{ padding: '10px', fontSize: '14px' }}
              >
                Lost SIM access? Use a recovery code
              </button>
            </form>
          ) : step === 'otp' ? (
            /* OTP Verification Step */
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors min-h-[44px]"
                  style={{ fontSize: '14px', marginBottom: '16px', gap: '4px' }}
                >
                  <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
                  Back
                </button>

                <label
                  className="block font-medium text-gray-700 dark:text-gray-300"
                  style={{ fontSize: '14px', marginBottom: '10px' }}
                >
                  Verification Code
                </label>
                <p
                  className="text-gray-500 dark:text-gray-400"
                  style={{ fontSize: '13px', marginBottom: '14px' }}
                >
                  Enter the 6-digit code sent to {formattedPhone}
                </p>

                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="000000"
                  maxLength={6}
                  className={cn(
                    "w-full text-center border border-gray-200 dark:border-gray-600",
                    "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                    "transition-all duration-200"
                  )}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    fontSize: '24px',
                    letterSpacing: '0.5em',
                  }}
                  autoFocus
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '20px' }}
                >
                  <p className="text-red-600 dark:text-red-400" style={{ fontSize: '14px' }}>{error}</p>
                </div>
              )}

              <button
                type="button"
                disabled={loading || otp.length !== 6 || otpCooldownRemaining > 0}
                onClick={handleVerifyOtp}
                className={cn(
                  "w-full font-medium flex items-center justify-center transition-all duration-300",
                  otp.length === 6 && !loading && otpCooldownRemaining === 0
                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
                style={{ padding: '14px 20px', borderRadius: '12px', gap: '8px', fontSize: '15px', position: 'relative', zIndex: 10 }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: '18px', height: '18px' }} />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield style={{ width: '18px', height: '18px' }} />
                    Verify
                  </>
                )}
              </button>
              {otpCooldownRemaining > 0 && (
                <p className="text-xs text-center text-gray-500 dark:text-gray-400" style={{ marginTop: '8px' }}>
                  Too many incorrect attempts. You can verify again in {otpCooldownRemaining}s.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  resetOtpSendState();
                  setStep('phone');
                  setOtp('');
                  resetOtpGuard();
                  setError('');
                }}
                className="w-full text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors min-h-[44px]"
                style={{ marginTop: '12px', padding: '10px', fontSize: '14px' }}
              >
                Didn&apos;t receive code? Try again
              </button>

              <button
                type="button"
                onClick={() => { setStep('recovery'); setError(''); }}
                className="w-full text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
                style={{ padding: '10px', fontSize: '14px' }}
              >
                Use recovery code instead
              </button>
            </form>
          ) : step === 'email' ? (
            /* Email Magic Link Step */
            <form onSubmit={handleSendEmailLink}>
              <div style={{ marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors min-h-[44px]"
                  style={{ fontSize: '14px', marginBottom: '16px', gap: '4px' }}
                >
                  <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
                  Back
                </button>

                <label
                  className="block font-medium text-gray-700 dark:text-gray-300"
                  style={{ fontSize: '14px', marginBottom: '10px' }}
                >
                  Email Address
                </label>
                <p
                  className="text-gray-500 dark:text-gray-400"
                  style={{ fontSize: '13px', marginBottom: '14px' }}
                >
                  Enter your email to receive a one-time sign-in link.
                </p>

                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={handleEmailChange}
                    placeholder="you@example.com"
                    className={cn(
                      "w-full border border-gray-200 dark:border-gray-600",
                      "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                      "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                      "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                      "transition-all duration-200"
                    )}
                    style={{
                      padding: '15px 48px 15px 16px',
                      borderRadius: '12px',
                      fontSize: '16px',
                    }}
                    autoFocus
                  />
                  <Mail
                    className="absolute text-orange-400"
                    style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px' }}
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '20px' }}
                >
                  <p className="text-red-600 dark:text-red-400" style={{ fontSize: '14px' }}>{error}</p>
                </div>
              )}

              {emailMessage && (
                <div
                  className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800"
                  style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '20px' }}
                >
                  <p className="text-emerald-700 dark:text-emerald-300" style={{ fontSize: '14px' }}>{emailMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email.trim()}
                className={cn(
                  "w-full font-medium flex items-center justify-center transition-all duration-300",
                  email.trim() && !loading
                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
                style={{ padding: '14px 20px', borderRadius: '12px', gap: '8px', fontSize: '15px' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: '18px', height: '18px' }} />
                    Sending link...
                  </>
                ) : (
                  <>
                    <Mail style={{ width: '18px', height: '18px' }} />
                    Send Magic Link
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setError(''); setEmailMessage(''); }}
                className="w-full text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
                style={{ marginTop: '12px', padding: '10px', fontSize: '14px' }}
              >
                Use phone verification instead
              </button>
            </form>
          ) : (
            /* Recovery Code Step */
            <form onSubmit={handleRecoverySignIn}>
              <div style={{ marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors min-h-[44px]"
                  style={{ fontSize: '14px', marginBottom: '16px', gap: '4px' }}
                >
                  <ArrowRight style={{ width: '16px', height: '16px', transform: 'rotate(180deg)' }} />
                  Back
                </button>

                <label
                  className="block font-medium text-gray-700 dark:text-gray-300"
                  style={{ fontSize: '14px', marginBottom: '10px' }}
                >
                  Recovery Sign-In
                </label>
                <p
                  className="text-gray-500 dark:text-gray-400"
                  style={{ fontSize: '13px', marginBottom: '14px' }}
                >
                  Enter your phone number and one saved recovery code.
                </p>

                <div className="relative" style={{ marginBottom: '10px' }}>
                  <span
                    className="absolute text-gray-500 dark:text-gray-400 font-medium"
                    style={{ left: '16px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px' }}
                  >
                    +63
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="9171234567"
                    className={cn(
                      "w-full border border-gray-200 dark:border-gray-600",
                      "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                      "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                      "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                      "transition-all duration-200"
                    )}
                    style={{
                      padding: '15px 48px 15px 56px',
                      borderRadius: '12px',
                      fontSize: '16px',
                    }}
                  />
                </div>

                <input
                  type="text"
                  value={recoveryCode}
                  onChange={handleRecoveryCodeChange}
                  placeholder="ABCD-EFGH-JKLM"
                  className={cn(
                    "w-full border border-gray-200 dark:border-gray-600",
                    "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                    "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                    "transition-all duration-200"
                  )}
                  style={{
                    padding: '15px 16px',
                    borderRadius: '12px',
                    fontSize: '16px',
                  }}
                  autoFocus
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '20px' }}
                >
                  <p className="text-red-600 dark:text-red-400" style={{ fontSize: '14px' }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || phone.length < 10 || recoveryCode.length < 12}
                className={cn(
                  "w-full font-medium flex items-center justify-center transition-all duration-300",
                  phone.length >= 10 && recoveryCode.length >= 12 && !loading
                    ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
                )}
                style={{ padding: '14px 20px', borderRadius: '12px', gap: '8px', fontSize: '15px' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" style={{ width: '18px', height: '18px' }} />
                    Signing in...
                  </>
                ) : (
                  <>
                    <KeyRound style={{ width: '18px', height: '18px' }} />
                    Sign In with Recovery Code
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => { setStep('phone'); setRecoveryCode(''); setError(''); }}
                className="w-full text-gray-500 dark:text-gray-400 hover:text-orange-500 transition-colors"
                style={{ marginTop: '12px', padding: '10px', fontSize: '14px' }}
              >
                Use SMS verification instead
              </button>
            </form>
          )}

          {/* Footer */}
          <div
            className="border-t border-gray-200 dark:border-gray-700"
            style={{ marginTop: '24px', paddingTop: '16px' }}
          >
            <p
              className="text-center text-gray-400 dark:text-gray-500"
              style={{ fontSize: '12px' }}
            >
              By continuing, you agree to our{' '}
              <button type="button" onClick={() => onOpenLegal?.('terms')} className="underline text-orange-500 hover:text-orange-600 dark:hover:text-orange-400">
                Terms of Service
              </button>{' '}and{' '}
              <button type="button" onClick={() => onOpenLegal?.('privacy')} className="underline text-orange-500 hover:text-orange-600 dark:hover:text-orange-400">
                Privacy Policy
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
