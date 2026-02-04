import React, { useState } from 'react';
import { User, Truck, Package, ArrowRight, Loader2, Building2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterScreen({ darkMode }) {
  const { authUser, createUserProfile } = useAuth();
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('shipper');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = {
    bg: darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100',
    card: darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textMuted: darkMode ? 'text-gray-400' : 'text-gray-600',
    input: darkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500',
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
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Failed to create profile. Please try again.');
    }
    // If successful, AuthContext will handle the state update
  };

  return (
    <div className={`min-h-screen ${theme.bg} flex items-center justify-center p-4`}>
      <div className={`w-full max-w-md ${theme.card} rounded-2xl shadow-xl border p-8`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h1 className={`text-2xl font-bold ${theme.text}`}>Complete Your Profile</h1>
          <p className={`text-sm ${theme.textMuted} mt-1`}>
            Welcome! Let's set up your account
          </p>
          {authUser?.phoneNumber && (
            <p className={`text-xs ${theme.textMuted} mt-2`}>
              Phone: {authUser.phoneNumber}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <div className="mb-4">
            <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
              Your Name *
            </label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder="Juan dela Cruz"
                className={`w-full pl-4 pr-10 py-3 rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                autoFocus
              />
              <User className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme.textMuted}`} />
            </div>
          </div>

          {/* Business Name */}
          <div className="mb-4">
            <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
              Business/Company Name (Optional)
            </label>
            <div className="relative">
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="ABC Trading Co."
                className={`w-full pl-4 pr-10 py-3 rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
              />
              <Building2 className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 ${theme.textMuted}`} />
            </div>
          </div>

          {/* Email (Optional) */}
          <div className="mb-6">
            <label className={`block text-sm font-medium ${theme.textMuted} mb-2`}>
              Email (Optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full px-4 py-3 rounded-xl border ${theme.input} focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>

          {/* Role Selection */}
          <div className="mb-6">
            <label className={`block text-sm font-medium ${theme.textMuted} mb-3`}>
              I am a... *
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('shipper')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  role === 'shipper'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : `${darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`
                }`}
              >
                <Package className={`w-8 h-8 mx-auto mb-2 ${role === 'shipper' ? 'text-blue-500' : theme.textMuted}`} />
                <p className={`text-sm font-medium ${role === 'shipper' ? 'text-blue-600 dark:text-blue-400' : theme.text}`}>
                  Shipper
                </p>
                <p className={`text-xs ${theme.textMuted} mt-1`}>
                  I need to ship cargo
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('trucker')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  role === 'trucker'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                    : `${darkMode ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'}`
                }`}
              >
                <Truck className={`w-8 h-8 mx-auto mb-2 ${role === 'trucker' ? 'text-orange-500' : theme.textMuted}`} />
                <p className={`text-sm font-medium ${role === 'trucker' ? 'text-orange-600 dark:text-orange-400' : theme.text}`}>
                  Trucker
                </p>
                <p className={`text-xs ${theme.textMuted} mt-1`}>
                  I have trucks for hire
                </p>
              </button>
            </div>
            <p className={`text-xs ${theme.textMuted} mt-2 text-center`}>
              You can switch roles anytime in your profile
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className={`w-full py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all
              ${name.trim() && !loading
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating Profile...
              </>
            ) : (
              <>
                Get Started
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className={`mt-6 pt-6 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <p className={`text-xs text-center ${theme.textMuted}`}>
            Your information is secure and will only be used to improve your experience
          </p>
        </div>
      </div>
    </div>
  );
}
