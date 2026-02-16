import React, { useState } from 'react';
import { X, Users, TrendingUp, DollarSign, ArrowRight } from 'lucide-react';
import api from '../../services/api';

export default function BrokerOnboardingModal({ open, onClose, onActivate, userRole = 'shipper' }) {
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    setLoading(true);
    try {
      await api.broker.register();
      onActivate?.();
      onClose();
    } catch (error) {
      console.error('Broker activation error:', error);
      alert('Failed to activate broker features. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const benefits = [
    {
      icon: DollarSign,
      title: 'Earn Passive Income',
      description: 'Get 3-6% commission on every referred transaction',
    },
    {
      icon: TrendingUp,
      title: 'Unlimited Earning Potential',
      description: 'No limits on referrals - the more you share, the more you earn',
    },
    {
      icon: Users,
      title: 'Help Grow the Network',
      description: 'Share GetGo with friends and grow the logistics community',
    },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 size-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors z-10"
        >
          <X className="size-4 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="size-14 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
              <Users className="size-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome to GetGo!</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">Want to earn extra income?</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            As a {userRole}, you can also become a <strong className="text-green-600 dark:text-green-400">GetGo Broker</strong> and earn commissions by referring others to the platform.
          </p>

          {/* Benefits */}
          <div className="space-y-3 mb-6">
            {benefits.map((benefit, idx) => {
              const Icon = benefit.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                >
                  <div className="size-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <Icon className="size-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white mb-1">{benefit.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{benefit.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTAs */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors disabled:opacity-50"
            >
              Maybe Later
            </button>
            <button
              onClick={handleActivate}
              disabled={loading}
              className="flex-1 px-4 py-3 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
            >
              {loading ? (
                'Activating...'
              ) : (
                <>
                  Become a Broker
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>

          {/* Fine print */}
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            You can activate broker features anytime from your profile
          </p>
        </div>
      </div>
    </div>
  );
}
