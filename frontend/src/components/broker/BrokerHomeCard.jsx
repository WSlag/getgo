import React from 'react';
import { X, Users, ArrowRight } from 'lucide-react';

export default function BrokerHomeCard({ onActivate, onDismiss, className = '' }) {
  return (
    <div className={`relative rounded-xl border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 overflow-hidden ${className}`}>
      {/* Dismiss Button */}
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 size-7 rounded-full bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-800 flex items-center justify-center transition-all shadow-sm z-10"
        aria-label="Dismiss"
      >
        <X className="size-4 text-gray-600 dark:text-gray-400" />
      </button>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="size-12 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
            <Users className="size-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white">Earn While You Ship</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Become a GetGo Broker</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Commission Rate</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">3-6%</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">Earning Potential</p>
            <p className="text-lg font-bold text-green-600 dark:text-green-400">Unlimited</p>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onActivate}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-500/30"
        >
          Activate Broker
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* Decorative Element */}
      <div className="absolute -bottom-10 -right-10 size-32 rounded-full bg-green-200/20 dark:bg-green-800/20 blur-2xl pointer-events-none" />
    </div>
  );
}
