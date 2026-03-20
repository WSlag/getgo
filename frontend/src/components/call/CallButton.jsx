import React from 'react';
import { Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Small green phone-icon button for initiating a voice call.
 * Designed to slot into modal headers and card action rows.
 */
export function CallButton({ onCall, disabled, title, className, iconClassName }) {
  return (
    <button
      type="button"
      onClick={onCall}
      disabled={disabled}
      title={title || 'Voice call'}
      aria-label={title || 'Start voice call'}
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all duration-200',
        'w-9 h-9 shrink-0',
        'bg-gradient-to-br from-green-500 to-emerald-600',
        'text-white shadow-md shadow-green-500/30',
        'hover:from-green-400 hover:to-emerald-500 hover:shadow-green-400/40 hover:scale-105',
        'active:scale-95',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:shadow-none',
        className
      )}
    >
      <Phone className={cn('size-4', iconClassName)} />
    </button>
  );
}
