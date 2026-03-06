import { cn } from '@/lib/utils';

export const activityPillBaseClass = [
  'inline-flex',
  'h-11',
  'lg:h-[34px]',
  'shrink-0',
  'whitespace-nowrap',
  'items-center',
  'justify-center',
  'rounded-xl',
  'px-5',
  'lg:px-6',
  'text-sm',
  'font-medium',
  'leading-none',
  'transition-all',
  'duration-200',
  'focus-visible:outline-none',
  'focus-visible:ring-2',
  'focus-visible:ring-ring',
  'focus-visible:ring-offset-2',
].join(' ');

export const activityPillActiveClass = 'bg-primary text-primary-foreground shadow-sm shadow-primary/30';
export const activityPillInactiveClass = 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground';
export const activityPillRowClass = 'flex flex-wrap gap-x-3 gap-y-2';

export function activityPillClass(isActive, className) {
  return cn(
    activityPillBaseClass,
    isActive ? activityPillActiveClass : activityPillInactiveClass,
    className
  );
}
