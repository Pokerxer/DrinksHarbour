'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as Icon from 'react-icons/pi';

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, placeDetails?: any) => void;
  onClearError?: () => void;
  error?: string;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

interface PlaceDetails {
  formatted_address: string;
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  geometry: {
    location: {
      lat: () => number;
      lng: () => number;
    };
  };
  place_id: string;
}

const loadGoogleMapsScript = (apiKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps?.places) {
      resolve();
      return;
    }

    // Check if script is already loading
    const existingScript = document.getElementById('google-maps-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Script failed to load')));
      return;
    }

    // Create script element
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    // Use legacy places library for broader compatibility
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    
    // Check for Google Maps initialization errors
    (window as any).gm_authFailure = () => {
      console.error('Google Maps authentication failed - Invalid API Key');
      reject(new Error('Invalid API Key'));
    };
    
    script.onload = () => {
      // Wait a bit to check if auth failed
      setTimeout(() => {
        if (window.google?.maps) {
          resolve();
        } else {
          reject(new Error('Google Maps failed to initialize'));
        }
      }, 100);
    };
    script.onerror = () => reject(new Error('Script failed to load'));
    document.head.appendChild(script);
  });
};

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value: initialValue,
  onChange,
  onClearError,
  error,
  placeholder = "Start typing your address...",
  label = "Address",
  required = true,
}) => {
  // Ensure value is always a string (never undefined)
  const value = initialValue ?? '';
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey || apiKey === 'your_google_maps_api_key_here' || apiKey === 'your_key_here') {
      console.warn('Google Maps API key not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your .env.local file');
      setIsLoading(false);
      setLoadError('API key not configured');
      return;
    }

    // Suppress Google Maps deprecation warnings in development
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      if (args[0]?.includes?.('google.maps.places')) return;
      if (args[0]?.includes?.('As of March 1st, 2025')) return;
      originalWarn.apply(console, args);
    };

    loadGoogleMapsScript(apiKey)
      .then(() => {
        setIsLoaded(true);
        setIsLoading(false);
        console.log('✅ Google Maps loaded successfully');
      })
      .catch((err) => {
        console.error('❌ Failed to load Google Maps:', err);
        if (err.message === 'Invalid API Key') {
          setLoadError('invalid_key');
        } else {
          setLoadError('Failed to load Google Maps');
        }
        setIsLoading(false);
      })
      .finally(() => {
        // Restore console.warn
        console.warn = originalWarn;
      });
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current) return;

    try {
      // Check if Places API is available
      if (!window.google?.maps?.places) {
        console.warn('Google Maps Places API not available');
        setLoadError('Places API not available');
        return;
      }

      // Initialize autocomplete
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: 'ng' }, // Restrict to Nigeria by default
      });

      // Listen for place selection
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace() as PlaceDetails;
        
        if (place && place.formatted_address) {
          onChange(place.formatted_address, {
            formattedAddress: place.formatted_address,
            placeId: place.place_id,
            latitude: place.geometry?.location?.lat(),
            longitude: place.geometry?.location?.lng(),
            addressComponents: place.address_components?.reduce((acc, component) => {
              const type = component.types[0];
              acc[type] = component.long_name;
              return acc;
            }, {} as Record<string, string>),
          });
          setShowSuggestions(false);
          onClearError?.();
        }
      });

      return () => {
        if (autocompleteRef.current) {
          window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
        }
      };
    } catch (err) {
      console.error('Failed to initialize autocomplete:', err);
      setLoadError('Failed to initialize address autocomplete');
    }
  }, [isLoaded, onChange, onClearError]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    onClearError?.();
  };

  if (isLoading) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon.PiMapPin size={18} />
          </div>
          <input
            type="text"
            disabled
            value=""
            className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 bg-gray-100 text-gray-500 text-sm"
            placeholder="Loading address search..."
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  // Show error state with fallback input
  if (loadError || !isLoaded) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon.PiMapPin size={18} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={value || ''}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm
              ${error 
                ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-200' 
                : 'border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-200'
              } outline-none transition-colors`}
          />
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <Icon.PiX size={16} />
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
            <Icon.PiWarningCircle size={12} />
            {error}
          </p>
        )}
        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-800 font-medium mb-1">
            ⚠️ Address autocomplete unavailable
          </p>
          <p className="text-xs text-amber-700 mb-2">
            {loadError === 'API key not configured' 
              ? 'Google Maps API key is not configured.' 
              : loadError === 'invalid_key'
              ? 'Your API key is invalid or not properly configured.'
              : 'Google Maps API failed to load.'}
          </p>
          {loadError === 'invalid_key' ? (
            <>
              <p className="text-xs text-amber-700 font-medium">Common causes for invalid key:</p>
              <ol className="text-xs text-amber-700 mt-1 ml-4 list-decimal">
                <li>API key was copied incorrectly (check for spaces or missing characters)</li>
                <li><strong>Maps JavaScript API</strong> is not enabled in Google Cloud Console</li>
                <li><strong>Places API</strong> is not enabled in Google Cloud Console</li>
                <li>API key has HTTP referrer restrictions that don't include localhost:3000</li>
                <li>Billing is not enabled on your Google Cloud project</li>
              </ol>
              <p className="text-xs text-amber-700 mt-2">
                Check your key in <code className="bg-amber-100 px-1 rounded">.env.local</code> and verify APIs are enabled at <a href="https://console.cloud.google.com/apis/library" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a>
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-amber-700">
                To enable address autocomplete:
              </p>
              <ol className="text-xs text-amber-700 mt-1 ml-4 list-decimal">
                <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                <li>Create a new project or select existing one</li>
                <li>Enable <strong>Places API</strong> and <strong>Maps JavaScript API</strong></li>
                <li>Create an API key</li>
                <li>Add key to <code className="bg-amber-100 px-1 rounded">.env.local</code>:<br/>
                  <code className="bg-amber-100 px-1 rounded text-xs">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here</code>
                </li>
              </ol>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Icon.PiMapPin size={18} />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`w-full pl-10 pr-3 py-2.5 rounded-lg border text-sm
            ${error 
              ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-200' 
              : 'border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-200'
            } outline-none transition-colors`}
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <Icon.PiX size={16} />
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
};

// Add TypeScript declarations for Google Maps
declare global {
  interface Window {
    google: typeof google;
  }
}

export default AddressAutocomplete;
