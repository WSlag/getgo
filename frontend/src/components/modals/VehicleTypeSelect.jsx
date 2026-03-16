import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VEHICLE_TYPE_GROUPS } from '@/utils/constants';

export function VehicleTypeSelect({ value, onChange, error, placeholder = 'Select vehicle' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (open && searchRef.current) {
      searchRef.current.focus();
    }
  }, [open]);

  function handleToggle() {
    setOpen((prev) => {
      if (prev) setSearch('');
      return !prev;
    });
  }

  function handleSelect(type) {
    onChange(type);
    setOpen(false);
    setSearch('');
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
    }
  }

  const query = search.toLowerCase();
  const filteredGroups = VEHICLE_TYPE_GROUPS.map((group) => ({
    ...group,
    types: query
      ? group.types.filter((t) => t.toLowerCase().includes(query))
      : group.types,
  })).filter((group) => group.types.length > 0);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border bg-input-background px-4 text-sm outline-none transition-all duration-200',
          'focus:ring-2 focus:ring-ring focus:ring-offset-2',
          error ? 'border-red-500' : 'border-border',
          open && 'ring-2 ring-ring ring-offset-2'
        )}
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={cn('size-4 opacity-50 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg">
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle type..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}>
                <X className="size-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-72 overflow-y-auto p-1">
            {filteredGroups.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No vehicle found</p>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.label}>
                  <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    {group.label}
                  </p>
                  {group.types.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleSelect(type)}
                      className={cn(
                        'flex w-full items-center rounded-lg px-3 py-2 text-sm text-left outline-none transition-colors',
                        'hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/40 dark:hover:text-orange-400',
                        value === type && 'bg-orange-500 text-white hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:text-white'
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VehicleTypeSelect;
