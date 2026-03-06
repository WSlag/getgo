import { cn } from '@/lib/utils';

export const activityPillBaseClass = [
  'inline-flex',
  'min-h-11',
  'lg:min-h-8',
  'min-w-[3.25rem]',
  'lg:min-w-[3rem]',
  'shrink-0',
  'whitespace-nowrap',
  'items-center',
  'justify-center',
  'rounded-xl',
  'px-7',
  'py-0.5',
  'lg:px-4',
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

export const activityPillActiveClass = 'bg-primary text-primary-foreground shadow-sm shadow-primary/25';
export const activityPillInactiveClass = 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground';
export const activityPillRowClass = 'flex flex-wrap gap-x-3 gap-y-2.5 lg:gap-x-3.5';

export function activityPillClass(isActive, className) {
  return cn(
    activityPillBaseClass,
    isActive ? activityPillActiveClass : activityPillInactiveClass,
    className
  );
}
