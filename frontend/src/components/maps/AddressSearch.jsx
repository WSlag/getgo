import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { autocomplete, isGeocodingAvailable } from '../../services/geocodingService';
import { philippineCities, getCoordinates } from '../../utils/cityCoordinates';

/**
 * AddressSearch - Location search with autocomplete
 * Falls back to city dropdown when API is not available
 */
export default function AddressSearch({
  value,
  onChange,
  onSelect,
  placeholder = 'Search location...',
  label,
  darkMode = false,
  className = '',
  error,
  required = false,
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [useDropdown, setUseDropdown] = useState(!isGeocodingAvailable());
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Debounce timer
  const debounceRef = useRef(null);

  // Update query when value prop changes
  useEffect(() => {
    if (value !== query) {
      setQuery(value || '');
    }
  }, [value]);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (useDropdown) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await autocomplete(query, { limit: 6 });
        setSuggestions(results);
      } catch (error) {
        console.error('Autocomplete error:', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, useDropdown]);

  // Close dropdown when clicking outside
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
    const newValue = e.target.value;
    setQuery(newValue);
    onChange?.(newValue);
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

  const theme = {
    bg: darkMode ? 'bg-gray-800' : 'bg-white',
    bgHover: darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50',
    border: darkMode ? 'border-gray-600' : 'border-gray-300',
    text: darkMode ? 'text-white' : 'text-gray-900',
    textSecondary: darkMode ? 'text-gray-400' : 'text-gray-500',
    input: darkMode ? 'bg-gray-700 text-white placeholder-gray-400' : 'bg-white text-gray-900 placeholder-gray-400',
  };

  // City dropdown mode (fallback when no API key)
  if (useDropdown) {
    const filteredCities = query
      ? philippineCities.filter(city =>
          city.toLowerCase().includes(query.toLowerCase())
        )
      : philippineCities;

    return (
      <div ref={containerRef} className={`relative ${className}`}>
        {label && (
          <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder={placeholder}
            className={`w-full px-3 pr-10 py-2.5 rounded-lg border ${theme.border} ${theme.input} focus:ring-2 focus:ring-amber-500 focus:border-transparent transition`}
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme.textSecondary} hover:text-gray-700`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-xs mt-1">{error}</p>
        )}

        {isOpen && filteredCities.length > 0 && (
          <div className={`absolute z-50 w-full mt-1 ${theme.bg} border ${theme.border} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
            {filteredCities.slice(0, 10).map((city) => (
              <button
                key={city}
                type="button"
                onClick={() => handleCitySelect(city)}
                className={`w-full px-4 py-2.5 text-left flex items-center gap-3 ${theme.bgHover} transition`}
              >
                <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <span className={theme.text}>{city}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Autocomplete mode (when API key is available)
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className={`block text-sm font-medium mb-1.5 ${theme.text}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full px-3 pr-10 py-2.5 rounded-lg border ${theme.border} ${theme.input} focus:ring-2 focus:ring-amber-500 focus:border-transparent transition`}
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme.textSecondary} hover:text-gray-700`}
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {error && (
        <p className="text-red-500 text-xs mt-1">{error}</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className={`absolute z-50 w-full mt-1 ${theme.bg} border ${theme.border} rounded-lg shadow-lg max-h-60 overflow-y-auto`}>
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              className={`w-full px-4 py-2.5 text-left flex items-start gap-3 ${theme.bgHover} transition`}
            >
              <MapPin className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className={`font-medium ${theme.text}`}>{item.name}</div>
                {item.region && (
                  <div className={`text-xs ${theme.textSecondary}`}>
                    {item.region}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && suggestions.length === 0 && !loading && (
        <div className={`absolute z-50 w-full mt-1 ${theme.bg} border ${theme.border} rounded-lg shadow-lg p-4 text-center`}>
          <p className={theme.textSecondary}>No locations found</p>
        </div>
      )}
    </div>
  );
}
