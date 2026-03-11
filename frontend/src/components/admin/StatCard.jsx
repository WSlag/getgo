import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-blue-500/30',
  trend,
  trendLabel,
  onClick,
  className,
}) {
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'w-full rounded-[14px] border border-slate-200 bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
        'dark:border-slate-800 dark:bg-slate-900',
        onClick && 'cursor-pointer transition-all duration-200 hover:border-orange-300 hover:shadow-md active:scale-[0.99] dark:hover:border-orange-700',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {title}
          </p>
          <p className="truncate text-2xl font-bold text-slate-900 dark:text-white lg:text-3xl">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
          {trend !== undefined && (
            <div className="mt-2 flex items-center gap-1">
              {trend >= 0 ? (
                <TrendingUp className="size-4 text-emerald-500" />
              ) : (
                <TrendingDown className="size-4 text-red-500" />
              )}
              <span
                className={cn(
                  'text-sm font-medium',
                  trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                )}
              >
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              {trendLabel && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {trendLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'size-10 shrink-0 rounded-[10px] shadow-[0_6px_12px_rgba(0,0,0,0.10)] flex items-center justify-center',
            iconColor
          )}>
            <Icon className="size-5 text-white" />
          </div>
        )}
      </div>
    </Wrapper>
  );
}

export function StatCardSkeleton({ className }) {
  return (
    <div
      className={cn(
        'w-full rounded-[14px] border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]',
        'dark:border-slate-800 dark:bg-slate-900',
        'animate-pulse',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-3 h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="mb-2 h-8 w-32 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
        </div>
        <div className="size-10 rounded-[10px] bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

export default StatCard;
