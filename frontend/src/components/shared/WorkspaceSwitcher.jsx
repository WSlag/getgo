import React from 'react';
import { Ship, Truck, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getWorkspaceLabel } from '@/utils/workspace';

const roleIcon = {
  shipper: Ship,
  trucker: Truck,
  broker: Users,
};

export function WorkspaceSwitcher({
  value = 'shipper',
  options = ['shipper'],
  onChange,
  className,
  compact = false,
  showLabel = true,
}) {
  const normalizedOptions = options.filter(Boolean);
  if (normalizedOptions.length <= 1) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showLabel && !compact && (
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Workspace
        </span>
      )}
      <div
        className={cn(
          'inline-flex items-center',
          compact ? 'gap-2' : 'gap-3'
        )}
      >
        {normalizedOptions.map((role) => {
          const Icon = roleIcon[role] || Ship;
          const isActive = role === value;

          return (
            <button
              key={role}
              type="button"
              onClick={() => onChange?.(role)}
              className={cn(
                'inline-flex items-center justify-center border-b-2 border-transparent font-semibold transition-colors active:scale-95',
                compact ? 'h-7 px-1.5 text-xs gap-1.5' : 'h-8 px-2 text-sm gap-2',
                isActive
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
              )}
              aria-pressed={isActive}
            >
              <Icon className={compact ? 'size-3.5' : 'size-4'} />
              <span>{getWorkspaceLabel(role)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default WorkspaceSwitcher;
