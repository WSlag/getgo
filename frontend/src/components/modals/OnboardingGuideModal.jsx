import React, { useState } from 'react';
import { X, Package, Truck, FileText, CreditCard, Search, MessageSquare, ArrowRight, ChevronLeft, ChevronRight, MapPin, Banknote, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const SHIPPER_STEPS = [
  {
    icon: Package,
    iconGradient: 'from-orange-400 to-orange-600',
    iconShadow: 'shadow-orange-500/30',
    title: 'Welcome to GetGo!',
    subtitle: 'Philippine Trucking Backload Marketplace',
    description: 'GetGo connects shippers like you with trusted truckers across the Philippines — no middlemen, no hassle.',
    highlights: [
      { icon: Package, label: 'Post cargo listings', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
      { icon: Truck, label: 'Get bids from truckers', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: FileText, label: 'Secure contracts & payments', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    ],
  },
  {
    icon: MapPin,
    iconGradient: 'from-blue-400 to-blue-600',
    iconShadow: 'shadow-blue-500/30',
    title: 'Post Your Cargo',
    subtitle: 'Step 1 of 3',
    description: 'Create a cargo listing to let truckers find and bid on your shipment.',
    highlights: [
      { icon: MapPin, label: 'Set pickup & delivery locations', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Package, label: 'Describe weight & cargo type', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
      { icon: Banknote, label: 'Set your budget range', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    ],
    tip: 'Tap the orange "Post Cargo" button in the sidebar or bottom bar to get started.',
  },
  {
    icon: MessageSquare,
    iconGradient: 'from-purple-400 to-purple-600',
    iconShadow: 'shadow-purple-500/30',
    title: 'Browse Bids & Chat',
    subtitle: 'Step 2 of 3',
    description: "Once posted, truckers will bid on your cargo. Review their profiles, ratings, and prices — then chat to negotiate.",
    highlights: [
      { icon: Star, label: 'Check trucker ratings & reviews', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
      { icon: MessageSquare, label: 'Chat directly with truckers', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
      { icon: Search, label: 'Compare multiple bids', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    ],
    tip: 'Visit "My Bookings" in the sidebar to manage all your active cargo listings.',
  },
  {
    icon: CreditCard,
    iconGradient: 'from-green-400 to-emerald-600',
    iconShadow: 'shadow-green-500/30',
    title: 'Contracts & GCash',
    subtitle: 'Step 3 of 3',
    description: 'Accept a bid to generate a contract. Pay securely via GCash and track your shipment in real-time.',
    highlights: [
      { icon: FileText, label: 'Digital contract auto-generated', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: CreditCard, label: 'Pay via GCash — fast & secure', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
      { icon: Truck, label: 'Track shipment live on map', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
    ],
    tip: "You're protected — payment is only released when both parties confirm delivery.",
  },
];

const TRUCKER_STEPS = [
  {
    icon: Truck,
    iconGradient: 'from-emerald-400 to-emerald-600',
    iconShadow: 'shadow-emerald-500/30',
    title: 'Welcome to GetGo!',
    subtitle: 'Philippine Trucking Backload Marketplace',
    description: 'GetGo connects truckers like you with shippers who need cargo moved — find backloads and maximize every trip.',
    highlights: [
      { icon: Search, label: 'Browse available cargo', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Banknote, label: 'Bid on shipments you want', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
      { icon: FileText, label: 'Earn with secure contracts', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    ],
  },
  {
    icon: Search,
    iconGradient: 'from-blue-400 to-blue-600',
    iconShadow: 'shadow-blue-500/30',
    title: 'Find Cargo Listings',
    subtitle: 'Step 1 of 3',
    description: 'Browse open cargo listings from shippers across the Philippines. Filter by route, weight, and price.',
    highlights: [
      { icon: MapPin, label: 'Filter by pickup & delivery area', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Package, label: 'See cargo type & weight details', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
      { icon: Truck, label: 'Find backloads along your route', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    ],
    tip: 'Switch to the "Cargo" tab on the home screen to see all available shipments.',
  },
  {
    icon: MessageSquare,
    iconGradient: 'from-purple-400 to-purple-600',
    iconShadow: 'shadow-purple-500/30',
    title: 'Bid & Negotiate',
    subtitle: 'Step 2 of 3',
    description: 'Place a competitive bid on cargo that matches your truck and route. Chat with the shipper to agree on terms.',
    highlights: [
      { icon: Banknote, label: 'Set your price competitively', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
      { icon: MessageSquare, label: 'Chat directly with shippers', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
      { icon: Star, label: 'Build your rating & reputation', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    ],
    tip: 'Your rating is your reputation — complete deliveries well to earn 5-star reviews.',
  },
  {
    icon: Banknote,
    iconGradient: 'from-green-400 to-emerald-600',
    iconShadow: 'shadow-green-500/30',
    title: 'Complete & Earn',
    subtitle: 'Step 3 of 3',
    description: "When your bid is accepted, a contract is generated. Complete the delivery and get paid — it's that simple.",
    highlights: [
      { icon: FileText, label: 'Digital contract protects you', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Truck, label: 'Update shipment status live', color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
      { icon: Banknote, label: 'Platform fee paid after delivery', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    ],
    tip: 'Visit "My Bids" to track all your active bids and accepted contracts.',
  },
];

export function OnboardingGuideModal({ open, onClose, userRole = 'shipper', userName = '' }) {
  const [step, setStep] = useState(0);

  const steps = userRole === 'trucker' ? TRUCKER_STEPS : SHIPPER_STEPS;
  const current = steps[step];
  const isLast = step === steps.length - 1;
  const isFirst = step === 0;
  const StepIcon = current.icon;

  const handleClose = () => {
    setStep(0);
    onClose();
  };

  const handleNext = () => {
    if (isLast) {
      handleClose();
    } else {
      setStep(s => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setStep(s => s - 1);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative bg-white dark:bg-gray-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 size-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center transition-colors"
        >
          <X className="size-4 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Step Progress Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-5 pb-1">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                'rounded-full transition-all duration-300',
                i === step
                  ? 'w-6 h-2 bg-orange-500'
                  : 'size-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 pt-4">
          {/* Icon Header */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className={cn(
              'size-16 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg mb-4',
              current.iconGradient,
              current.iconShadow
            )}>
              <StepIcon className="size-8 text-white" />
            </div>
            {current.subtitle && (
              <p className="text-xs font-medium text-orange-500 uppercase tracking-wide mb-1">
                {current.subtitle}
              </p>
            )}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {step === 0 && userName ? `Welcome, ${userName}!` : current.title}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Feature Highlights */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {current.highlights.map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700',
                    item.bg
                  )}
                >
                  <div className="size-8 rounded-lg bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center flex-shrink-0">
                    <ItemIcon className={cn('size-4', item.color)} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tip */}
          {current.tip && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-3 mb-5">
              <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                <span className="font-semibold">💡 Tip: </span>{current.tip}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {/* Prev */}
            {!isFirst ? (
              <button
                onClick={handlePrev}
                className="flex items-center justify-center size-10 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
              >
                <ChevronLeft className="size-5 text-gray-500 dark:text-gray-400" />
              </button>
            ) : (
              <button
                onClick={handleClose}
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors flex-shrink-0 px-2"
              >
                Skip
              </button>
            )}

            {/* Next / Get Started */}
            <button
              onClick={handleNext}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm',
                'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
                'shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40',
                'hover:scale-[1.02] active:scale-[0.98] transition-all duration-300'
              )}
            >
              {isLast ? (
                <>
                  Get Started
                  <ArrowRight className="size-4" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="size-4" />
                </>
              )}
            </button>
          </div>

          {/* Step counter text */}
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-3">
            {step + 1} of {steps.length}
          </p>
        </div>
      </div>
    </div>
  );
}

export default OnboardingGuideModal;
