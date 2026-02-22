import React, { useState } from 'react';
import { User, Truck, Package, ArrowRight, Loader2, Building2, Mail, Link2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@/lib/utils';
import BrokerOnboardingModal from '../broker/BrokerOnboardingModal';
import { OnboardingGuideModal } from '../modals/OnboardingGuideModal';

export default function RegisterScreen({ darkMode }) {
  const { authUser, createUserProfile } = useAuth();
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('karga_referral_code') || '';
  });
  const [role, setRole] = useState('shipper');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showBrokerOnboarding, setShowBrokerOnboarding] = useState(false);

  const buildDefaultName = () => {
    const digits = String(authUser?.phoneNumber || '').replace(/\D/g, '');
    const suffix = digits.slice(-4) || 'User';
    return `User ${suffix}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError('');

    const result = await createUserProfile({
      name: name.trim(),
      businessName: businessName.trim() || name.trim(),
      email: email.trim() || null,
      role,
      referralCode: referralCode.trim() || null,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Failed to create profile. Please try again.');
    }
  };

  const handleSkipForNow = async () => {
    if (loading) return;

    setLoading(true);
    setError('');

    const fallbackName = buildDefaultName();
    const result = await createUserProfile({
      name: fallbackName,
      businessName: fallbackName,
      email: null,
      role,
      referralCode: referralCode.trim() || null,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Failed to continue. Please try again.');
    }
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center"
      style={{ padding: '16px' }}
    >
      <div
        className="w-full bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700"
        style={{ maxWidth: '440px', borderRadius: '16px', padding: '32px' }}
      >
        {/* Header */}
        <div className="text-center" style={{ marginBottom: '28px' }}>
          <div
            className="inline-flex items-center justify-center bg-gradient-to-br from-green-500 to-emerald-600"
            style={{ width: '56px', height: '56px', borderRadius: '14px', marginBottom: '16px' }}
          >
            <User className="text-white" style={{ width: '28px', height: '28px' }} />
          </div>
          <h1
            className="font-bold text-gray-900 dark:text-white"
            style={{ fontSize: '24px', marginBottom: '8px' }}
          >
            Complete Your Profile
          </h1>
          <p
            className="text-gray-500 dark:text-gray-400"
            style={{ fontSize: '14px' }}
          >
            Welcome! Let's set up your account
          </p>
          {authUser?.phoneNumber && (
            <p
              className="text-orange-500 font-medium"
              style={{ fontSize: '13px', marginTop: '8px' }}
            >
              Phone: {authUser.phoneNumber}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div style={{ marginBottom: '16px' }}>
            <label
              className="block font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: '14px', marginBottom: '8px' }}
            >
              Your Name *
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Juan dela Cruz"
                className={cn(
                  "w-full border border-gray-200 dark:border-gray-600",
                  "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                  "transition-all duration-200"
                )}
                style={{
                  padding: '14px 48px 14px 16px',
                  borderRadius: '12px',
                  fontSize: '15px',
                }}
                autoFocus
              />
              <User
                className="absolute text-gray-400"
                style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px' }}
              />
            </div>
          </div>

          {/* Business Name */}
          <div style={{ marginBottom: '16px' }}>
            <label
              className="block font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: '14px', marginBottom: '8px' }}
            >
              Business/Company Name (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="ABC Trading Co."
                className={cn(
                  "w-full border border-gray-200 dark:border-gray-600",
                  "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                  "transition-all duration-200"
                )}
                style={{
                  padding: '14px 48px 14px 16px',
                  borderRadius: '12px',
                  fontSize: '15px',
                }}
              />
              <Building2
                className="absolute text-gray-400"
                style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px' }}
              />
            </div>
          </div>

          {/* Email (Optional) */}
          <div style={{ marginBottom: '24px' }}>
            <label
              className="block font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: '14px', marginBottom: '8px' }}
            >
              Email (Optional)
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={cn(
                  "w-full border border-gray-200 dark:border-gray-600",
                  "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                  "transition-all duration-200"
                )}
                style={{
                  padding: '14px 48px 14px 16px',
                  borderRadius: '12px',
                  fontSize: '15px',
                }}
              />
              <Mail
                className="absolute text-gray-400"
                style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px' }}
              />
            </div>
          </div>

          {/* Referral Code (Optional) */}
          <div style={{ marginBottom: '24px' }}>
            <label
              className="block font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: '14px', marginBottom: '8px' }}
            >
              Referral Code (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                placeholder="SHP12345"
                className={cn(
                  "w-full border border-gray-200 dark:border-gray-600",
                  "bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500",
                  "transition-all duration-200"
                )}
                style={{
                  padding: '14px 48px 14px 16px',
                  borderRadius: '12px',
                  fontSize: '15px',
                }}
              />
              <Link2
                className="absolute text-gray-400"
                style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', width: '20px', height: '20px' }}
              />
            </div>
            <p className="text-gray-400 dark:text-gray-500" style={{ fontSize: '12px', marginTop: '8px' }}>
              If invited by a broker, enter their code here.
            </p>
          </div>

          {/* Role Selection */}
          <div style={{ marginBottom: '24px' }}>
            <label
              className="block font-medium text-gray-700 dark:text-gray-300"
              style={{ fontSize: '14px', marginBottom: '12px' }}
            >
              I am a... *
            </label>
            <div className="grid grid-cols-2" style={{ gap: '12px' }}>
              <button
                type="button"
                onClick={() => setRole('shipper')}
                className={cn(
                  "border-2 transition-all duration-200 text-center",
                  role === 'shipper'
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700"
                )}
                style={{ padding: '16px 12px', borderRadius: '12px' }}
              >
                <Package
                  className={cn(
                    "mx-auto",
                    role === 'shipper' ? "text-orange-500" : "text-gray-400"
                  )}
                  style={{ width: '28px', height: '28px', marginBottom: '8px' }}
                />
                <p
                  className={cn(
                    "font-semibold",
                    role === 'shipper' ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"
                  )}
                  style={{ fontSize: '14px', marginBottom: '4px' }}
                >
                  Shipper
                </p>
                <p
                  className="text-gray-500 dark:text-gray-400"
                  style={{ fontSize: '12px' }}
                >
                  I need to ship cargo
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('trucker')}
                className={cn(
                  "border-2 transition-all duration-200 text-center",
                  role === 'trucker'
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 bg-white dark:bg-gray-700"
                )}
                style={{ padding: '16px 12px', borderRadius: '12px' }}
              >
                <Truck
                  className={cn(
                    "mx-auto",
                    role === 'trucker' ? "text-orange-500" : "text-gray-400"
                  )}
                  style={{ width: '28px', height: '28px', marginBottom: '8px' }}
                />
                <p
                  className={cn(
                    "font-semibold",
                    role === 'trucker' ? "text-orange-600 dark:text-orange-400" : "text-gray-700 dark:text-gray-300"
                  )}
                  style={{ fontSize: '14px', marginBottom: '4px' }}
                >
                  Trucker
                </p>
                <p
                  className="text-gray-500 dark:text-gray-400"
                  style={{ fontSize: '12px' }}
                >
                  I have trucks for hire
                </p>
              </button>
            </div>
            <p
              className="text-center text-gray-400 dark:text-gray-500"
              style={{ fontSize: '12px', marginTop: '12px' }}
            >
              You can switch roles anytime in your profile
            </p>
          </div>

          {error && (
            <div
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              style={{ padding: '12px 14px', borderRadius: '10px', marginBottom: '20px' }}
            >
              <p className="text-red-600 dark:text-red-400" style={{ fontSize: '14px' }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className={cn(
              "w-full font-medium flex items-center justify-center transition-all duration-300",
              name.trim() && !loading
                ? "bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:scale-[1.02] active:scale-[0.98]"
                : "bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
            )}
            style={{ padding: '14px 20px', borderRadius: '12px', gap: '8px', fontSize: '15px' }}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" style={{ width: '18px', height: '18px' }} />
                Creating Profile...
              </>
            ) : (
              <>
                Get Started
                <ArrowRight style={{ width: '18px', height: '18px' }} />
              </>
            )}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={handleSkipForNow}
            className={cn(
              "w-full mt-3 font-medium transition-colors",
              loading
                ? "text-gray-400 cursor-not-allowed"
                : "text-gray-500 hover:text-orange-500 dark:text-gray-400 dark:hover:text-orange-400"
            )}
            style={{ padding: '10px 12px', fontSize: '14px' }}
          >
            Skip for now
          </button>
          <p className="text-center text-gray-400 dark:text-gray-500" style={{ fontSize: '12px', marginTop: '2px' }}>
            You can complete details later in Profile settings.
          </p>
        </form>

        {/* Footer */}
        <div
          className="border-t border-gray-200 dark:border-gray-700"
          style={{ marginTop: '24px', paddingTop: '16px' }}
        >
          <p
            className="text-center text-gray-400 dark:text-gray-500"
            style={{ fontSize: '12px' }}
          >
            Your information is secure and will only be used to improve your experience
          </p>
        </div>
      </div>

      {/* Onboarding Guide Modal — shown first after registration */}
      <OnboardingGuideModal
        open={showOnboarding}
        onClose={() => {
          setShowOnboarding(false);
          setShowBrokerOnboarding(true);
        }}
        userRole={role}
        userName={name}
      />

      {/* Broker Onboarding Modal — shown after onboarding guide */}
      <BrokerOnboardingModal
        open={showBrokerOnboarding}
        onClose={() => setShowBrokerOnboarding(false)}
        onActivate={() => setShowBrokerOnboarding(false)}
        userRole={role}
      />
    </div>
  );
}
