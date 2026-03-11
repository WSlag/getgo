import { X, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppButton } from '@/components/ui/app-button';
import { AppCard } from '@/components/ui/app-card';
import { StatusChip } from '@/components/ui/status-chip';

export default function BrokerHomeCard({ onActivate, onDismiss, className = '' }) {
  return (
    <AppCard
      className={cn(
        'relative overflow-hidden border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20',
        className
      )}
    >
      {/* Dismiss Button */}
      <AppButton
        onClick={onDismiss}
        variant="secondary"
        size="icon"
        className="absolute top-3 right-3 z-10"
        aria-label="Dismiss"
      >
        <X className="size-4 text-slate-600 dark:text-slate-400" />
      </AppButton>

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 pr-10">
          <div className="size-12 rounded-[10px] bg-emerald-500 flex items-center justify-center text-white shadow-[0_6px_12px_rgba(0,0,0,0.10)]">
            <Users className="size-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[16px] font-semibold text-slate-900 dark:text-white">
                Earn While You Ship
              </h3>
              <StatusChip variant="verified">Broker</StatusChip>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">Become a GetGo Broker</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-2 gap-3">
          <AppCard className="rounded-[14px] border-slate-200 bg-white p-3 shadow-none dark:border-slate-700 dark:bg-slate-900/90">
            <p className="text-xs text-slate-500 dark:text-slate-400">Commission Rate</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">3-6%</p>
          </AppCard>
          <AppCard className="rounded-[14px] border-slate-200 bg-white p-3 shadow-none dark:border-slate-700 dark:bg-slate-900/90">
            <p className="text-xs text-slate-500 dark:text-slate-400">Earning Potential</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">Unlimited</p>
          </AppCard>
        </div>

        {/* CTA */}
        <AppButton
          onClick={onActivate}
          variant="success"
          className="w-full"
        >
          Activate Broker
          <ArrowRight className="size-4" />
        </AppButton>
      </div>
    </AppCard>
  );
}
