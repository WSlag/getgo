import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { autocomplete, isGeocodingAvailable } from '../../services/geocodingService';
import { philippineCities, getCoordinates } from '../../utils/cityCoordinates';

/**
 * AddressSearch - location search with autocomplete.
 * Falls back to city list when geocoding API is unavailable.
 */
export default function AddressSearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Search location...',
  label,
  className = '',
  error,
  required = false,
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [useDropdown] = useState(!isGeocodingAvailable());
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (value !== query) setQuery(value || '');
  }, [value, query]);

  useEffect(() => {
    if (useDropdown) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await autocomplete(query, { limit: 6 });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, useDropdown]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const nextValue = e.target.value;
    setQuery(nextValue);
    onChange?.(nextValue);
    setIsOpen(true);
  };

  const handleSelect = (item) => {
    const selectedValue = item.name || item.label;
    setQuery(selectedValue);
    onChange?.(selectedValue);
    onSelect?.({
      name: selectedValue,
      label: item.label,
      lat: item.lat,
      lng: item.lng,
    });
    setIsOpen(false);
    setSuggestions([]);
  };

  const handleCitySelect = (cityName) => {
    const coords = getCoordinates(cityName);
    setQuery(cityName);
    onChange?.(cityName);
    onSelect?.({
      name: cityName,
      label: cityName,
      lat: coords.lat,
      lng: coords.lng,
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    setQuery('');
    onChange?.('');
    onSelect?.(null);
    inputRef.current?.focus();
  };

  const filteredCities = query
    ? philippineCities.filter((city) => city.toLowerCase().includes(query.toLowerCase()))
    : philippineCities;

  const listItems = useDropdown ? filteredCities.slice(0, 10) : suggestions;
  const showNoResult = !useDropdown && isOpen && query.length >= 2 && suggestions.length === 0 && !loading;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-1 text-destructive">*</span>}
        </label>
      )}

      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="pr-10"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-primary" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Clear location"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {isOpen && listItems.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg">
          {listItems.map((item) => {
            const key = useDropdown ? item : item.id;
            const labelValue = useDropdown ? item : item.name;
            const subLabel = useDropdown ? '' : item.region;
            return (
              <button
                key={key}
                type="button"
                onClick={() => (useDropdown ? handleCitySelect(item) : handleSelect(item))}
                className="flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{labelValue}</p>
                  {subLabel ? <p className="truncate text-xs text-muted-foreground">{subLabel}</p> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showNoResult && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover p-4 text-center shadow-lg">
          <p className="text-sm text-muted-foreground">No locations found</p>
        </div>
      )}
    </div>
  );
}
