import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
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
        onClick && 'hover:shadow-md hover:border-orange-300 dark:hover:border-orange-700 cursor-pointer transition-all duration-200',
        className
      )}
      style={{ padding: isDesktop ? '20px 24px' : '16px 20px' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
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
          <div className={cn('rounded-xl p-3', iconColor)}>
            <Icon className="size-6" />
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
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="size-12 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    </div>
  );
}

export default StatCard;
