import { cn } from '@/lib/utils';

export const activityPillBaseClass = [
  'inline-flex',
  'min-h-8',
  'lg:min-h-8',
  'min-w-[2.75rem]',
  'lg:min-w-[2.75rem]',
  'shrink-0',
  'whitespace-nowrap',
  'items-center',
  'justify-center',
  'rounded-full',
  'px-4',
  'py-0',
  'text-sm',
  'font-medium',
  'leading-none',
  'transition-all',
  'duration-200',
  'focus-visible:outline-none',
  'focus-visible:ring-1',
  'focus-visible:ring-foreground/30',
  'focus-visible:ring-offset-0',
].join(' ');

export const activityPillActiveClass = 'bg-primary text-primary-foreground shadow-sm shadow-primary/25';
export const activityPillInactiveClass = 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground';
export const activityPillRowClass = 'flex flex-wrap gap-x-3 gap-y-1.5 lg:gap-x-3.5';

export function activityPillClass(isActive, className) {
  return cn(
    activityPillBaseClass,
    isActive ? activityPillActiveClass : activityPillInactiveClass,
    className
  );
}
