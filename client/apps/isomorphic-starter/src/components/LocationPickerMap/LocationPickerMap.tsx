'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import type { AddressDetails } from '@/components/AddressAutocomplete/AddressAutocomplete';

interface LocationPickerMapProps {
  lat: number | null;
  lon: number | null;
  onLocationChange: (details: AddressDetails) => void;
}

declare global {
  interface Window {
    google: any;
    __mapsInitCallback?: () => void;
  }
}

const NIGERIA_CENTER = { lat: 9.0765, lng: 7.3986 };
const DEFAULT_ZOOM   = 16;
const COUNTRY_ZOOM   = 6;
const CALLBACK_NAME  = '__mapsInitCallback';

// ── Google Maps loader (proxied through our backend) ──────────────────────────

type LoadState = 'idle' | 'loading' | 'ready';
let loadState: LoadState = 'idle';
const pendingCallbacks: Array<() => void> = [];

function loadMaps(callback: () => void) {
  if (loadState === 'ready') { callback(); return; }
  pendingCallbacks.push(callback);
  if (loadState === 'loading') return;
  loadState = 'loading';

  window[CALLBACK_NAME] = () => {
    loadState = 'ready';
    pendingCallbacks.forEach(cb => cb());
    pendingCallbacks.length = 0;
  };

  const script   = document.createElement('script');
  script.async   = true;
  script.defer   = true;
  // Load via backend proxy — API key never touches the browser bundle
  script.src     = `${API_URL}/api/places/maps-script?callback=${CALLBACK_NAME}`;
  script.onerror = () => {
    loadState = 'idle'; // allow retry
    console.error('[Maps] Failed to load Google Maps JS API via proxy');
  };
  document.head.appendChild(script);
}

// ── Reverse geocode via backend ───────────────────────────────────────────────

async function reverseGeocode(lat: number, lon: number): Promise<AddressDetails | null> {
  try {
    const res  = await fetch(`${API_URL}/api/places/reverse?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    return data.success && data.data ? (data.data as AddressDetails) : null;
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lon, onLocationChange }) => {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef   = useRef<any>(null);
  const [ready,     setReady]     = useState(false);
  const [locating,  setLocating]  = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsError,  setGpsError]  = useState('');

  // ── Load SDK ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMaps(() => setReady(true));
  }, []);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    const center = lat && lon ? { lat, lng: lon } : NIGERIA_CENTER;
    const zoom   = lat && lon ? DEFAULT_ZOOM : COUNTRY_ZOOM;

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom,
      disableDefaultUI:  true,
      zoomControl:       true,
      gestureHandling:   'greedy',
      styles: [
        { featureType: 'poi',     stylers: [{ visibility: 'simplified' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });

    // Custom red pin using AdvancedMarkerElement if available, else Marker
    function makeMarker(position: any) {
      const marker = new window.google.maps.Marker({
        position,
        map,
        draggable: true,
        icon: {
          path:         window.google.maps.SymbolPath.CIRCLE,
          scale:        10,
          fillColor:    '#c0392b',
          fillOpacity:  1,
          strokeColor:  '#ffffff',
          strokeWeight: 2.5,
        },
      });
      marker.addListener('dragend', async () => {
        const p = marker.getPosition();
        setGeocoding(true);
        const d = await reverseGeocode(p.lat(), p.lng());
        setGeocoding(false);
        if (d) onLocationChange(d);
      });
      return marker;
    }

    if (lat && lon) {
      markerRef.current = makeMarker({ lat, lng: lon });
    }

    map.addListener('click', async (e: any) => {
      const newLat = e.latLng.lat();
      const newLon = e.latLng.lng();
      if (markerRef.current) {
        markerRef.current.setPosition(e.latLng);
      } else {
        markerRef.current = makeMarker(e.latLng);
      }
      map.panTo(e.latLng);
      setGeocoding(true);
      const d = await reverseGeocode(newLat, newLon);
      setGeocoding(false);
      if (d) onLocationChange(d);
    });

    mapInstance.current = map;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync pin when lat/lon change from address autocomplete ─────────────────
  useEffect(() => {
    if (!mapInstance.current || !ready || !lat || !lon) return;
    const pos = new window.google.maps.LatLng(lat, lon);
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      const marker = new window.google.maps.Marker({
        position: pos, map: mapInstance.current, draggable: true,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 10, fillColor: '#c0392b', fillOpacity: 1,
          strokeColor: '#ffffff', strokeWeight: 2.5,
        },
      });
      marker.addListener('dragend', async () => {
        const p = marker.getPosition();
        setGeocoding(true);
        const d = await reverseGeocode(p.lat(), p.lng());
        setGeocoding(false);
        if (d) onLocationChange(d);
      });
      markerRef.current = marker;
    }
    mapInstance.current.panTo(pos);
    mapInstance.current.setZoom(DEFAULT_ZOOM);
  }, [lat, lon, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS ─────────────────────────────────────────────────────────────────────
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported by your browser'); return; }
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        setLocating(false);

        if (mapInstance.current && ready) {
          const latLng = new window.google.maps.LatLng(newLat, newLon);
          if (markerRef.current) {
            markerRef.current.setPosition(latLng);
          } else {
            const marker = new window.google.maps.Marker({
              position: latLng, map: mapInstance.current, draggable: true,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 10, fillColor: '#c0392b', fillOpacity: 1,
                strokeColor: '#ffffff', strokeWeight: 2.5,
              },
            });
            marker.addListener('dragend', async () => {
              const p = marker.getPosition();
              setGeocoding(true);
              const d = await reverseGeocode(p.lat(), p.lng());
              setGeocoding(false);
              if (d) onLocationChange(d);
            });
            markerRef.current = marker;
          }
          mapInstance.current.setCenter(latLng);
          mapInstance.current.setZoom(DEFAULT_ZOOM);
        }

        setGeocoding(true);
        const details = await reverseGeocode(newLat, newLon);
        setGeocoding(false);
        if (details) onLocationChange(details);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === 1
            ? 'Location access denied — allow it in your browser settings'
            : 'Could not get your location. Try again or pin manually.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [ready, onLocationChange]);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <Icon.PiMapTrifoldBold size={13} className="text-red-600" />
          Pin your exact location
          <span className="font-normal text-gray-400">(click map or drag pin)</span>
        </label>
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating || !ready}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {locating
            ? <span className="w-3 h-3 rounded-full border-2 border-red-200 border-t-red-700 animate-spin" />
            : <Icon.PiNavigationArrowBold size={13} />}
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div ref={mapRef} className="w-full h-[220px] bg-gray-100" />

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Loading map…</span>
            </div>
          </div>
        )}

        {geocoding && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-xs text-gray-600 font-medium px-3 py-1.5 rounded-full shadow flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-3 h-3 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
            Getting address…
          </div>
        )}

        {ready && !(lat && lon) && !geocoding && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-xs text-gray-500 px-3 py-1.5 rounded-full shadow whitespace-nowrap pointer-events-none">
            Click the map or press "Use my location"
          </div>
        )}
      </div>

      {gpsError && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} /> {gpsError}
        </p>
      )}
    </div>
  );
};

export default LocationPickerMap;
