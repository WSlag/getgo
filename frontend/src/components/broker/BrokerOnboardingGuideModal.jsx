import React, { useEffect, useRef, useState } from 'react';
import {
  Users, DollarSign, TrendingUp, Wallet, Link2, Copy, Share2,
  Percent, Clock3, Award, Banknote, CreditCard, ShieldCheck,
  ArrowUpRight, Package, Truck, Loader2, ArrowRight,
  ChevronLeft, ChevronRight, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import api from '../../services/api';

// ─── Enrollment Step (Step 0) ─────────────────────────────────────────────────
const ENROLLMENT_STEP = {
  icon: Users,
  iconGradient: 'from-green-400 to-emerald-600',
  iconShadow: 'shadow-green-500/30',
  title: 'Become a GetGo Broker',
  subtitle: 'Earn While You Share',
  description: 'Turn your network into income. Refer shippers and truckers to GetGo and earn commissions on every successful transaction.',
  highlights: [
    { icon: DollarSign, label: 'Earn 3-6% on every referred deal', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    { icon: TrendingUp, label: 'Grow through 4 earning tiers', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: Wallet, label: 'Request payouts via GCash or bank', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ],
};

// ─── Guide Steps (Steps 1–5) ──────────────────────────────────────────────────
const GUIDE_STEPS = [
  {
    icon: Link2,
    iconGradient: 'from-orange-400 to-orange-600',
    iconShadow: 'shadow-orange-500/30',
    title: 'Share Your Referral Code',
    subtitle: 'Step 1 of 5',
    description: 'Every broker gets a unique referral code. Share it with shippers and truckers so their sign-ups are attributed to you.',
    highlights: [
      { icon: Copy, label: 'Copy your code with one tap', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
      { icon: Share2, label: 'Share via SMS, Messenger, or social', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Link2, label: 'Your unique link: getgo.ph/r/YOURCODE', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    ],
    tip: 'Go to the Broker Dashboard and tap your referral code to copy or share it instantly.',
  },
  {
    icon: TrendingUp,
    iconGradient: 'from-blue-400 to-blue-600',
    iconShadow: 'shadow-blue-500/30',
    title: 'Track Referrals & Commissions',
    subtitle: 'Step 2 of 5',
    description: 'Your Broker Dashboard shows all your referred users, active deals, and earned commissions in real time.',
    highlights: [
      { icon: Users, label: 'See who signed up with your code', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: Percent, label: 'Track commissions per transaction', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
      { icon: Clock3, label: 'Monitor pending & completed deals', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    ],
    tip: 'Tap "Broker" in the sidebar or bottom navigation to open your dashboard anytime.',
  },
  {
    icon: Award,
    iconGradient: 'from-yellow-400 to-amber-600',
    iconShadow: 'shadow-amber-500/30',
    title: 'Tier System & Earning More',
    subtitle: 'Step 3 of 5',
    description: 'The more deals your referrals complete, the higher your tier climbs - and the bigger your commission rate.',
    highlights: [
      { icon: DollarSign, label: 'Starter: 3% commission - begin earning', color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800/60' },
      { icon: TrendingUp, label: 'Silver & Gold: 4-5% as you grow', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
      { icon: Award, label: 'Platinum: 6% - maximum earnings', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    ],
    tip: 'Your tier is based on total completed referred deals. Keep sharing to level up!',
  },
  {
    icon: Wallet,
    iconGradient: 'from-green-400 to-emerald-600',
    iconShadow: 'shadow-green-500/30',
    title: 'Request Payouts',
    subtitle: 'Step 4 of 5',
    description: 'Once your available balance reaches PHP 500, you can request a payout via GCash or bank transfer.',
    highlights: [
      { icon: Banknote, label: 'Minimum payout: PHP 500', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
      { icon: CreditCard, label: 'GCash or bank transfer options', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: ShieldCheck, label: 'Secure & verified processing', color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    ],
    tip: 'Go to "Request Payout" in your Broker Dashboard to withdraw your earnings.',
  },
  {
    icon: ArrowUpRight,
    iconGradient: 'from-purple-400 to-purple-600',
    iconShadow: 'shadow-purple-500/30',
    title: 'Refer Listings Directly',
    subtitle: 'Step 5 of 5',
    description: 'As a broker, you can refer specific cargo or truck listings directly to your attributed users - helping them find the right match faster.',
    highlights: [
      { icon: Package, label: 'Refer cargo listings to your truckers', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
      { icon: Truck, label: 'Refer truck listings to your shippers', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
      { icon: DollarSign, label: 'Earn commission when they transact', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
    ],
    tip: 'Tap the "Refer" button on any listing detail to share it with your attributed users.',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function BrokerOnboardingGuideModal({
  open,
  onClose,
  onDismiss,
  onComplete,
  onActivated,
  userRole = 'shipper',
  userName = '',
  isBroker = false,
}) {
  // Step 0 = enrollment, steps 1-5 = guide
  const [step, setStep] = useState(isBroker ? 1 : 0);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState('');
  const closeInProgressRef = useRef(false);

  const isEnrollmentStep = step === 0;
  const guideIndex = step - 1; // 0-based index into GUIDE_STEPS
  const current = isEnrollmentStep ? ENROLLMENT_STEP : GUIDE_STEPS[guideIndex];
  const isLastGuideStep = step === GUIDE_STEPS.length; // step 5
  const isFirstGuideStep = step === 1;
  const StepIcon = current.icon;

  useEffect(() => {
    if (open) {
      closeInProgressRef.current = false;
      setStep(isBroker ? 1 : 0);
      setActivationError('');
    }
  }, [open, isBroker]);

  const emitClose = (reason) => {
    if (closeInProgressRef.current) return;
    closeInProgressRef.current = true;
    setStep(isBroker ? 1 : 0);
    if (reason === 'completed') {
      onComplete?.();
    } else {
      onDismiss?.();
    }
    onClose?.(reason);
  };

  const handleActivate = async () => {
    setActivating(true);
    setActivationError('');
    try {
      await api.broker.register();
      onActivated?.();
      setStep(1);
    } catch (error) {
      console.error('Broker activation error:', error);
      setActivationError(error.message || 'Failed to activate. Please try again.');
    } finally {
      setActivating(false);
    }
  };

  const handleNext = () => {
    if (isLastGuideStep) {
      emitClose('completed');
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !activating) emitClose('dismissed'); }}>
      <DialogContent
        style={{ padding: 0 }}
        aria-describedby="broker-guide-description"
        className="bg-white dark:bg-gray-900 w-full max-w-[calc(100vw-32px)] sm:max-w-md lg:max-w-lg rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto border-0"
      >
        {/* Step Progress Dots — only for guide steps */}
        {!isEnrollmentStep && (
          <div className="flex items-center justify-center gap-2 pt-6 pb-2">
            {GUIDE_STEPS.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setStep(i + 1)}
                aria-label={`Go to step ${i + 1} of ${GUIDE_STEPS.length}`}
                aria-current={i === guideIndex ? 'step' : undefined}
                className={cn(
                  'rounded-full transition-all duration-300',
                  i === guideIndex
                    ? 'w-7 h-2.5 bg-orange-500'
                    : 'size-2.5 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                )}
              />
            ))}
          </div>
        )}

        {/* Content */}
        <div className={cn('px-7 pb-7', isEnrollmentStep ? 'pt-7' : 'pt-5')}>
          {/* Icon Header */}
          <div className="flex flex-col items-center text-center mb-7">
            <div
              className={cn(
                'size-20 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg mb-5',
                current.iconGradient,
                current.iconShadow
              )}
            >
              <StepIcon className="size-10 text-white" aria-hidden="true" />
            </div>
            {current.subtitle && (
              <p className={cn(
                'text-xs font-semibold uppercase tracking-widest mb-2',
                isEnrollmentStep ? 'text-green-500' : 'text-orange-500'
              )}>
                {current.subtitle}
              </p>
            )}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              {isEnrollmentStep && userName ? `Hey ${userName}!` : current.title}
            </h2>
            <p id="broker-guide-description" className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed max-w-xs">
              {current.description}
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="flex flex-col gap-3 mb-6">
            {current.highlights.map((item, i) => {
              const ItemIcon = item.icon;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-4 px-4 py-3.5 rounded-xl border border-gray-100 dark:border-gray-700',
                    item.bg
                  )}
                >
                  <div className="size-9 rounded-xl bg-white dark:bg-gray-800 shadow-sm flex items-center justify-center flex-shrink-0">
                    <ItemIcon className={cn('size-5', item.color)} aria-hidden="true" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Tip (guide steps only) */}
          {!isEnrollmentStep && current.tip && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl px-4 py-3.5 mb-6">
              <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed">
                <span className="font-semibold">Tip: </span>
                {current.tip}
              </p>
            </div>
          )}

          {/* Enrollment CTA */}
          {isEnrollmentStep && (
            <>
              {activationError && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-3 mb-4">
                  <AlertCircle className="size-4 text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">{activationError}</p>
                </div>
              )}
              <div className="flex gap-3 mb-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => emitClose('dismissed')}
                  disabled={activating}
                  className="flex-1 h-11 font-semibold border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  Maybe Later
                </Button>
                <button
                  type="button"
                  onClick={handleActivate}
                  disabled={activating}
                  className="flex-1 h-11 px-5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 active:scale-95"
                >
                  {activating ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      Activating...
                    </>
                  ) : (
                    <>
                      Become a Broker
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                You can activate broker features anytime from your profile
              </p>
            </>
          )}

          {/* Guide Navigation */}
          {!isEnrollmentStep && (
            <>
              <div className="flex items-center gap-3">
                {/* Prev / Skip */}
                {isFirstGuideStep ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => emitClose('dismissed')}
                    aria-label="Skip broker guide"
                    className="h-11 flex-shrink-0 px-4 font-semibold border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    Skip
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handlePrev}
                    aria-label="Previous step"
                    className="size-11 flex-shrink-0 border-gray-200 dark:border-gray-700"
                  >
                    <ChevronLeft className="size-5 text-gray-500 dark:text-gray-400" aria-hidden="true" />
                  </Button>
                )}

                {/* Next / Get Started */}
                <Button
                  type="button"
                  variant="gradient"
                  onClick={handleNext}
                  className="h-11 flex-1 gap-2 rounded-xl font-semibold"
                >
                  {isLastGuideStep ? (
                    <>
                      Get Started
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>

              {/* Step counter */}
              <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4">
                {guideIndex + 1} of {GUIDE_STEPS.length}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default BrokerOnboardingGuideModal;
