'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Icon from 'react-icons/pi';

export interface AddressDetails {
  formatted: string;
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  lat: number;
  lon: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, details?: AddressDetails) => void;
  onClearError?: () => void;
  error?: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

interface NominatimResult {
  place_id: string;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    island?: string;
    city?: string;
    city_district?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    county?: string;
    state_district?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function normalise(r: NominatimResult): AddressDetails {
  const a = r.address;

  // Street: house number + road name
  const streetParts = [a.house_number, a.road].filter(Boolean);
  const street = streetParts.length > 0
    ? streetParts.join(' ')
    : (r.name || r.display_name.split(',')[0]);

  // City: most specific populated place available
  const city =
    a.city ||
    a.town ||
    a.suburb ||        // e.g. "Victoria Island", "Maitama"
    a.village ||
    a.hamlet ||
    a.city_district ||
    a.county ||        // LGA as last resort
    '';

  return {
    formatted: r.display_name,
    street,
    city,
    state: a.state || '',
    postcode: a.postcode || '',
    country: a.country || 'Nigeria',
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  };
}

const MIN_CHARS = 4;
const DEBOUNCE_MS = 500;

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value: externalValue,
  onChange,
  onClearError,
  error,
  placeholder = 'Start typing your address…',
  label = 'Address',
  required = true,
}) => {
  const value = externalValue ?? '';
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep input in sync if parent resets value
  useEffect(() => {
    setInputValue(externalValue ?? '');
  }, [externalValue]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      return;
    }

    // Cancel previous in-flight request
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        countrycodes: 'ng',
        limit: '6',
        'accept-language': 'en',
      });

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        {
          signal: abortRef.current.signal,
          headers: {
            'User-Agent': 'DrinksHarbour/1.0 (support@drinksharbour.com)',
          },
        },
      );

      if (!res.ok) throw new Error('Search failed');
      const data: NominatimResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
      setActiveIndex(-1);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setFetchError('Could not load suggestions. Please type your address manually.');
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val, undefined);
    onClearError?.();

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), DEBOUNCE_MS);
  };

  const handleSelect = (result: NominatimResult) => {
    const details = normalise(result);
    // Use street line as the address field value (cleaner than the full display_name)
    const displayVal = details.street || result.display_name.split(',')[0];
    setInputValue(displayVal);
    setOpen(false);
    setResults([]);
    onChange(displayVal, details);
    onClearError?.();
  };

  const handleClear = () => {
    setInputValue('');
    setResults([]);
    setOpen(false);
    onChange('', undefined);
    onClearError?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      <div className="relative">
        {/* Map pin icon */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
          <Icon.PiMapPin size={18} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-10 ${inputValue ? 'pr-9' : 'pr-3'} py-2.5 rounded-lg border text-sm outline-none transition-colors
            ${error
              ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-200'
              : 'border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-200'
            }`}
        />

        {/* Right side: spinner or clear */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : inputValue ? (
            <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 transition-colors">
              <Icon.PiX size={16} />
            </button>
          ) : null}
        </div>

        {/* Suggestions dropdown */}
        {open && results.length > 0 && (
          <ul
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-56 overflow-y-auto"
            role="listbox"
          >
            {results.map((result, i) => {
              const parts = result.display_name.split(', ');
              const primary = parts.slice(0, 2).join(', ');
              const secondary = parts.slice(2).join(', ');
              return (
                <li
                  key={result.place_id}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(result); }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors text-sm
                    ${i === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                >
                  <Icon.PiMapPin size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{primary}</p>
                    {secondary && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">{secondary}</p>
                    )}
                  </div>
                </li>
              );
            })}
            <li className="flex items-center justify-end gap-1 px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              <span className="text-[10px] text-gray-400">Powered by</span>
              <span className="text-[10px] font-semibold text-gray-500">OpenStreetMap</span>
            </li>
          </ul>
        )}
      </div>

      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} />
          {error}
        </p>
      )}

      {fetchError && !error && (
        <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} />
          {fetchError}
        </p>
      )}

      {inputValue.length > 0 && inputValue.length < MIN_CHARS && !error && (
        <p className="mt-1 text-xs text-gray-400">
          Type at least {MIN_CHARS} characters to search
        </p>
      )}
    </div>
  );
};

export default AddressAutocomplete;
