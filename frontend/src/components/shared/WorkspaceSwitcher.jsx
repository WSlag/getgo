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
          'inline-flex items-center rounded-full border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 p-1 shadow-sm backdrop-blur',
          compact ? 'gap-1' : 'gap-1.5'
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
                'inline-flex items-center justify-center rounded-full font-semibold transition-all active:scale-95',
                compact ? 'h-8 px-3 text-xs gap-1.5' : 'h-9 px-4 text-sm gap-2',
                isActive
                  ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-sm shadow-orange-500/30'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
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

