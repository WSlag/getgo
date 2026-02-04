import React, { useState } from 'react';
import { Phone, ArrowRight, Shield, Truck, Package, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen({ darkMode, onSkipLogin }) {
  const { sendOtp, verifyOtp, authError } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'otp'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formattedPhone, setFormattedPhone] = useState('');

  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100',
    card: darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-600',
    input: darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    setLoading(true);
    setError('');

    const result = await sendOtp(phone, 'send-otp-button');

    setLoading(false);

    if (result.success) {
      setFormattedPhone(result.formattedPhone);
      setStep('otp');
    } else {
      setError(result.error || 'Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    console.log('Verify button clicked, OTP:', otp);

    if (!otp.trim() || otp.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    console.log('Calling verifyOtp...');
    const result = await verifyOtp(otp);
    console.log('verifyOtp result:', result);

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Invalid code. Please try again.');
    }
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

  const handleBack = () => {
    setStep('phone');
    setOtp('');
    setError('');
  };

  return (
    <div className={`min-h-screen ${theme.bg} flex items-center justify-center p-4`}>
      <div className={`w-full max-w-md ${theme.card} rounded-2xl shadow-xl border p-8`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
            <div className="flex items-center gap-1">
              <Truck className="w-5 h-5 text-white" />
              <Package className="w-5 h-5 text-white" />
            </div>
          </div>
          <h1 className={`text-2xl font-bold ${theme.text}`}>KARGA</h1>
          <p className={`text-sm ${theme.textMuted} mt-1`}>Philippine Trucking Marketplace</p>
        </div>

        {step === 'phone' ? (
          /* Phone Number Step */
          <form onSubmit={handleSendOtp}>
            <div className="mb-6">
              <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
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
                  className={`w-full pl-14 pr-4 py-3 rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  autoFocus
                />
                <Phone className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme.textMuted}`} />
              </div>
              <p className={`text-xs ${theme.textMuted} mt-2`}>
                We'll send a verification code to this number
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              id="send-otp-button"
              type="submit"
              disabled={loading || phone.length < 10}
              className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all
                ${phone.length >= 10 && !loading
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
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
          </form>
        ) : (
          /* OTP Verification Step */
          <form onSubmit={handleVerifyOtp}>
            <div className="mb-6">
              <button
                type="button"
                onClick={handleBack}
                className={`text-sm ${theme.textMuted} hover:text-blue-500 mb-4 flex items-center gap-1`}
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
                Back
              </button>

              <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
                Verification Code
              </label>
              <p className={`text-xs ${theme.textMuted} mb-4`}>
                Enter the 6-digit code sent to {formattedPhone}
              </p>

              <input
                type="text"
                value={otp}
                onChange={handleOtpChange}
                placeholder="000000"
                maxLength={6}
                className={`w-full text-center text-2xl tracking-[0.5em] py-4 rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all
                ${otp.length === 6 && !loading
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
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

            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); }}
              className={`w-full mt-3 py-2 text-sm ${theme.textMuted} hover:text-blue-500`}
            >
              Didn't receive code? Try again
            </button>
          </form>
        )}

        {/* Continue Browsing Button */}
        {onSkipLogin && (
          <div className="mt-6">
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
              className={`w-full mt-4 py-3 px-4 rounded-xl font-medium border-2 border-dashed transition-all
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
        <div className={`mt-8 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-xs text-center ${theme.textMuted}`}>
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
