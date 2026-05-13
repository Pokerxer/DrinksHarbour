'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';

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
  /** Called automatically with the best-match coordinates after every search,
   *  so shipping can be calculated without the user selecting from the dropdown. */
  onBestMatch?: (details: AddressDetails | null) => void;
  onClearError?: () => void;
  error?: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text?: string;
  };
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchPredictions(input: string, signal: AbortSignal): Promise<Prediction[]> {
  const res = await fetch(
    `${API_URL}/api/places/autocomplete?input=${encodeURIComponent(input)}`,
    { signal },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.success ? (data.data as Prediction[]) : [];
}

async function fetchDetails(placeId: string): Promise<AddressDetails | null> {
  const res = await fetch(`${API_URL}/api/places/details?place_id=${encodeURIComponent(placeId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.success ? (data.data as AddressDetails) : null;
}

// ── Component ─────────────────────────────────────────────────────────────────

const MIN_CHARS  = 3;
const DEBOUNCE_MS = 400;

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value: externalValue,
  onChange,
  onBestMatch,
  onClearError,
  error,
  placeholder = 'Estate, street or landmark…',
  label = 'Address',
  required = true,
}) => {
  const value = externalValue ?? '';
  const [inputValue, setInputValue]     = useState(value);
  const [predictions, setPredictions]   = useState<Prediction[]>([]);
  const [open, setOpen]                 = useState(false);
  const [loading, setLoading]           = useState(false);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  const [activeIndex, setActiveIndex]   = useState(-1);

  const timerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const abortRef      = useRef<AbortController | null>(null);
  const onBestMatchRef = useRef(onBestMatch);
  useEffect(() => { onBestMatchRef.current = onBestMatch; }, [onBestMatch]);

  useEffect(() => { setInputValue(externalValue ?? ''); }, [externalValue]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const search = useCallback(async (query: string) => {
    if (query.trim().length < MIN_CHARS) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    setLoading(true);
    setFetchError(null);

    const results = await fetchPredictions(query, signal);

    if (signal.aborted) return;

    setLoading(false);
    setPredictions(results);
    setOpen(results.length > 0);
    setActiveIndex(-1);

    // Silently fetch details for the top result so shipping can be calculated
    // without requiring the user to click a suggestion
    if (results.length > 0) {
      fetchDetails(results[0].place_id)
        .then(d => { if (!signal.aborted) onBestMatchRef.current?.(d); })
        .catch(() => {});
    } else {
      onBestMatchRef.current?.(null);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val, undefined);
    onClearError?.();
    setFetchError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(val), DEBOUNCE_MS);
  };

  const handleSelect = async (p: Prediction) => {
    setInputValue(p.structured_formatting.main_text);
    setOpen(false);
    setPredictions([]);

    const details = await fetchDetails(p.place_id);
    onChange(p.structured_formatting.main_text, details ?? undefined);
    onBestMatchRef.current?.(details);
    onClearError?.();
  };

  const handleClear = () => {
    setInputValue('');
    setPredictions([]);
    setOpen(false);
    onChange('', undefined);
    onBestMatchRef.current?.(null);
    onClearError?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(predictions[activeIndex]);
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
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
          <Icon.PiMapPin size={18} />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full pl-10 ${inputValue ? 'pr-9' : 'pr-3'} py-2.5 rounded-lg border text-sm outline-none transition-colors
            ${error
              ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-200'
              : 'border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-200'
            }`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {loading ? (
            <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : inputValue ? (
            <button type="button" onClick={handleClear} className="text-gray-400 hover:text-gray-600 transition-colors">
              <Icon.PiX size={16} />
            </button>
          ) : null}
        </div>

        {open && predictions.length > 0 && (
          <ul
            className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto"
            role="listbox"
          >
            {predictions.map((p, i) => (
              <li
                key={p.place_id}
                role="option"
                aria-selected={i === activeIndex}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex items-start gap-2.5 px-3 py-2.5 cursor-pointer transition-colors text-sm
                  ${i === activeIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <Icon.PiMapPin size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 truncate">
                    {p.structured_formatting.main_text}
                  </p>
                  {p.structured_formatting.secondary_text && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {p.structured_formatting.secondary_text}
                    </p>
                  )}
                </div>
              </li>
            ))}
            <li className="flex items-center justify-end gap-1 px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              <span className="text-[10px] text-gray-400">Powered by</span>
              <span className="text-[10px] font-semibold text-gray-500">Google</span>
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
