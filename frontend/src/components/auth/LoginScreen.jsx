import React, { useEffect, useState } from 'react';
import { Phone, ArrowRight, Shield, Loader2, KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Logo } from '../shared/Logo';

const OTP_MAX_RETRIES = 3;
const OTP_COOLDOWN_SECONDS = 30;

export default function LoginScreen({ darkMode, onSkipLogin, onOpenLegal }) {
  const { sendOtp, resetOtpSendState, verifyOtp, signInWithRecoveryCode } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'recovery'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');
  const [otpRetryCount, setOtpRetryCount] = useState(0);
  const [otpCooldownEndsAt, setOtpCooldownEndsAt] = useState(null);
  const [otpCooldownRemaining, setOtpCooldownRemaining] = useState(0);

  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-orange-50 to-amber-100',
    card: darkMode ? 'bg-gray-800/90 backdrop-blur-xl border-gray-700' : 'bg-white/80 backdrop-blur-xl border-gray-200/50',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-600',
    input: darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
  };

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
    e.preventDefault();
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
    // If successful, AuthContext will handle the state update
  };

  const handlePhoneChange = (e) => {
    // Only allow numbers and limit to 11 digits (09XXXXXXXXX format)
    const value = e.target.value.replace(/\D/g, '').slice(0, 11);
    setPhone(value);
    setError('');
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
    e.preventDefault();

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
    setRecoveryCode('');
    resetOtpGuard();
    setError('');
  };

  return (
    <div className={`min-h-screen ${theme.bg} flex items-center justify-center`} style={{ padding: '32px 24px' }}>
      <div className={`w-full max-w-md ${theme.card} rounded-2xl shadow-xl border`} style={{ padding: '40px 32px' }}>
        {/* Logo */}
        <div className="flex justify-center" style={{ marginBottom: '40px' }}>
          <Logo size="lg" />
        </div>

        {step === 'phone' ? (
          /* Phone Number Step */
          <form onSubmit={handleSendOtp}>
            <div style={{ marginBottom: '32px' }}>
              <label className={`block text-sm font-medium ${theme.textMuted}`} style={{ marginBottom: '12px' }}>
                Phone Number
              </label>
              <div className="relative">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textMuted}`}>
                  +63
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="9171234567"
                  className={`w-full rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  style={{ padding: '14px 16px 14px 56px' }}
                  autoFocus
                />
                <Phone className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme.textMuted}`} />
              </div>
              <p className={`text-xs ${theme.textMuted}`} style={{ marginTop: '12px' }}>
                We&apos;ll send a verification code to this number
              </p>
            </div>

            {error && (
              <div role="alert" className="bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg" style={{ marginBottom: '24px', padding: '12px' }}>
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              id="send-otp-button"
              type="submit"
              disabled={loading || phone.length < 10}
              style={{ padding: '14px 16px' }}
              className={`w-full rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95
                ${phone.length >= 10 && !loading
                  ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white hover:from-orange-500 hover:to-orange-700 shadow-lg shadow-orange-500/30'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </>
                )}
            </button>

            <button
              type="button"
              disabled={loading || phone.length < 10}
              onClick={handleRetryOtpSend}
              className={`w-full mt-2 py-2 text-sm ${theme.textMuted} hover:text-orange-500 ${loading || phone.length < 10 ? 'cursor-not-allowed opacity-70' : ''}`}
            >
              Retry OTP send
            </button>

            <button
              type="button"
              onClick={() => { setStep('recovery'); setError(''); }}
              className={`w-full mt-3 py-2 text-sm ${theme.textMuted} hover:text-orange-500`}
            >
              Lost SIM access? Use a recovery code
            </button>
          </form>
        ) : step === 'otp' ? (
          /* OTP Verification Step */
          <form onSubmit={handleVerifyOtp}>
            <div className="mb-8">
              <button
                type="button"
                onClick={handleBack}
                className={`text-sm ${theme.textMuted} hover:text-orange-500 mb-4 flex items-center gap-1`}
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back
              </button>

              <label className={`block text-sm font-medium ${theme.textMuted} mb-3`}>
                Verification Code
              </label>
              <p className={`text-xs ${theme.textMuted} mb-5`}>
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
                className={`w-full text-center text-2xl tracking-[0.5em] py-4 rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6 || otpCooldownRemaining > 0}
              className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95
                ${otp.length === 6 && !loading && otpCooldownRemaining === 0
                  ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white hover:from-orange-500 hover:to-orange-700 shadow-lg shadow-orange-500/30'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  Verify
                </>
                )}
            </button>
            {otpCooldownRemaining > 0 && (
              <p className={`text-xs text-center ${theme.textMuted}`} style={{ marginTop: '8px' }}>
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
              className={`w-full mt-3 py-2 text-sm ${theme.textMuted} hover:text-orange-500`}
            >
              Didn&apos;t receive code? Try again
            </button>

            <button
              type="button"
              onClick={() => { setStep('recovery'); setError(''); }}
              className={`w-full py-2 text-sm ${theme.textMuted} hover:text-orange-500`}
            >
              Use recovery code instead
            </button>
          </form>
        ) : (
          /* Recovery Code Step */
          <form onSubmit={handleRecoverySignIn}>
            <div className="mb-8">
              <button
                type="button"
                onClick={handleBack}
                className={`text-sm ${theme.textMuted} hover:text-orange-500 mb-4 flex items-center gap-1`}
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back
              </button>

              <label className={`block text-sm font-medium ${theme.textMuted} mb-3`}>
                Recovery Sign-In
              </label>
              <p className={`text-xs ${theme.textMuted} mb-5`}>
                Enter your phone number and one saved recovery code.
              </p>

              <div className="relative mb-3">
                <span className={`absolute left-4 top-1/2 -translate-y-1/2 ${theme.textMuted}`}>
                  +63
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="9171234567"
                  className={`w-full rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                  style={{ padding: '14px 16px 14px 56px' }}
                />
              </div>

              <input
                type="text"
                value={recoveryCode}
                onChange={handleRecoveryCodeChange}
                placeholder="ABCD-EFGH-JKLM"
                className={`w-full rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-orange-500`}
                style={{ padding: '14px 16px' }}
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || phone.length < 10 || recoveryCode.length < 12}
              className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all duration-300 hover:scale-105 active:scale-95
                ${phone.length >= 10 && recoveryCode.length >= 12 && !loading
                  ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white hover:from-orange-500 hover:to-orange-700 shadow-lg shadow-orange-500/30'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <KeyRound className="w-5 h-5" />
                  Sign In with Recovery Code
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setStep('phone'); setRecoveryCode(''); setError(''); }}
              className={`w-full mt-3 py-2 text-sm ${theme.textMuted} hover:text-orange-500`}
            >
              Use SMS verification instead
            </button>
          </form>
        )}

        {/* Continue Browsing Button */}
        {onSkipLogin && (
          <div style={{ marginTop: '32px' }}>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className={`px-2 ${darkMode ? 'bg-gray-800' : 'bg-white'} ${theme.textMuted}`}>or</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onSkipLogin}
              style={{ marginTop: '20px', padding: '14px 16px' }}
              className={`w-full rounded-xl font-medium border-2 border-dashed transition-all
                ${darkMode
                  ? 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                  : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-700'
                }`}
            >
              Continue Browsing (Demo Mode)
            </button>
          </div>
        )}

        {/* Footer */}
        <div className={`border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`} style={{ marginTop: '40px', paddingTop: '24px' }}>
          <p className={`text-xs text-center ${theme.textMuted}`}>
            By continuing, you agree to our{' '}
            <button type="button" onClick={() => onOpenLegal?.('terms')} className="underline text-orange-500 hover:text-orange-600">
              Terms of Service
            </button>{' '}and{' '}
            <button type="button" onClick={() => onOpenLegal?.('privacy')} className="underline text-orange-500 hover:text-orange-600">
              Privacy Policy
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
