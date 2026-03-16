import { useState, useRef, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { VEHICLE_TYPE_GROUPS } from '@/utils/constants';

function SearchInput({ value, onChange, inputRef }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-popover px-3 py-2.5">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search vehicle type..."
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="rounded-md p-0.5 hover:bg-muted">
          <X className="size-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function OptionsList({ groups, selected, onSelect }) {
  if (groups.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No vehicle found</p>;
  }

  return groups.map((group) => (
    <div key={group.label} className="py-1">
      <p className="sticky top-0 z-[1] bg-popover/95 backdrop-blur-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {group.label}
      </p>
      {group.types.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onSelect(type)}
          className={cn(
            'flex w-full items-center rounded-lg px-3 py-2.5 text-sm text-left outline-none transition-colors',
            'hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/40 dark:hover:text-orange-400',
            'active:bg-orange-100 dark:active:bg-orange-950/60',
            selected === type && 'bg-orange-500 text-white hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white'
          )}
        >
          {type}
        </button>
      ))}
    </div>
  ));
}

export function VehicleTypeSelect({ value, onChange, error, placeholder = 'Select vehicle' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef(null);
  const isMobile = !useMediaQuery('(min-width: 640px)');

  // Auto-focus search on open
  useEffect(() => {
    if (open) {
      // Small delay to let the DOM render before focusing
      const timer = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
    setSearch('');
  }, [open]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (open && isMobile) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open, isMobile]);

  const query = search.toLowerCase();
  const filteredGroups = VEHICLE_TYPE_GROUPS
    .map((g) => ({ ...g, types: query ? g.types.filter((t) => t.toLowerCase().includes(query)) : g.types }))
    .filter((g) => g.types.length > 0);

  function handleSelect(type) {
    onChange(type);
    setOpen(false);
  }

  // ── Mobile: bottom sheet ──
  if (isMobile) {
    return (
      <>
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border bg-input-background px-4 text-sm outline-none transition-all duration-200',
            'focus:ring-2 focus:ring-ring focus:ring-offset-2',
            error ? 'border-red-500' : 'border-border'
          )}
        >
          <span className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronDown className="size-4 shrink-0 opacity-50" />
        </button>

        {/* Bottom sheet overlay */}
        {open && (
          <div className="fixed inset-0 z-[100] flex flex-col justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-200" onClick={() => setOpen(false)} />

            {/* Sheet */}
            <div className="relative z-10 flex max-h-[75vh] flex-col rounded-t-2xl bg-popover shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
              {/* Drag handle */}
              <div className="flex justify-center py-2.5">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Title */}
              <p className="px-4 pb-2 text-sm font-semibold text-foreground">Select Vehicle Type</p>

              {/* Search */}
              <SearchInput value={search} onChange={setSearch} inputRef={searchRef} />

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-1 pb-[env(safe-area-inset-bottom,8px)]">
                <OptionsList groups={filteredGroups} selected={value} onSelect={handleSelect} />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Desktop: Radix Popover ──
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-xl border bg-input-background px-4 text-sm outline-none transition-all duration-200',
            'focus:ring-2 focus:ring-ring focus:ring-offset-2',
            error ? 'border-red-500' : 'border-border',
            open && 'ring-2 ring-ring ring-offset-2'
          )}
        >
          <span className={cn('truncate', value ? 'text-foreground' : 'text-muted-foreground')}>
            {value || placeholder}
          </span>
          <ChevronDown className={cn('size-4 shrink-0 opacity-50 transition-transform duration-200', open && 'rotate-180')} />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={16}
          avoidCollisions
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'z-[200] w-[var(--radix-popover-trigger-width)] rounded-xl border border-border bg-popover shadow-xl',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-top-2',
            'duration-200'
          )}
        >
          <SearchInput value={search} onChange={setSearch} inputRef={searchRef} />
          <div className="max-h-72 overflow-y-auto overscroll-contain p-1">
            <OptionsList groups={filteredGroups} selected={value} onSelect={handleSelect} />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default VehicleTypeSelect;
