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
    <div className={cn("flex flex-col items-center justify-center py-20 text-center", className)}>
      {Icon && (
        <div className="size-16 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center mb-4 shadow-lg">
          <Icon className="size-8 text-gray-400" />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          {title}
        </h3>
      )}
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <Button variant="outline" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
