import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

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
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        'rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm',
        'text-left w-full',
        onClick && 'hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 cursor-pointer transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]',
        className
      )}
      style={{ padding: isDesktop ? '20px 24px' : '16px 20px' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            {title}
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate">
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </p>
          )}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend >= 0 ? (
                <TrendingUp className="size-4 text-green-500" />
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
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {trendLabel}
                </span>
              )}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn(
            'size-10 rounded-lg flex items-center justify-center shadow-lg flex-shrink-0',
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
        'rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm',
        'animate-pulse',
        className
      )}
      style={{ padding: '16px 20px' }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="size-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

export default StatCard;
