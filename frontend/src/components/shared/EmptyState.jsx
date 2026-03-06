import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex size-16 items-center justify-center rounded-xl border border-border bg-gradient-to-br from-muted to-secondary shadow-sm">
          <Icon className="size-8 text-muted-foreground" />
        </div>
      )}
      {title && (
        <h3 className="text-base font-semibold text-foreground">
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-1 max-w-sm text-sm font-normal text-muted-foreground">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="gradient" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
