'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Icon from 'react-icons/pi';
import type { AddressDetails } from './delivery-address-autocomplete';

export interface LocationPickerMapProps {
  apiUrl: string;
  allowGeolocation?: boolean;
  onPinChange?: (lat: number, lon: number) => void;
  lat: number | null;
  lon: number | null;
  onLocationChange?: (details: AddressDetails) => void;
}

declare global {
  interface Window { google: any; __mapsInitCallback?: () => void; }
}

const NIGERIA_CENTER = { lat: 9.0765, lng: 7.3986 };
const DEFAULT_ZOOM   = 16;
const COUNTRY_ZOOM   = 6;
const CALLBACK_NAME  = '__mapsInitCallback';
// DEMO_MAP_ID enables AdvancedMarkerElement without a Cloud Console map ID
const MAP_ID         = 'DEMO_MAP_ID';

// ── Loader ────────────────────────────────────────────────────────────────────

type LoadState = 'idle' | 'loading' | 'ready';
let loadState: LoadState = 'idle';
let attempt = 0;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS  = [1000, 3000]; // ms before retry 1 and retry 2

interface Subscriber { onReady: () => void; onError: () => void; }
let subscribers: Subscriber[] = [];

function injectScript(apiUrl: string) {
  const s   = document.createElement('script');
  s.async   = true;
  s.defer   = true;
  s.src     = `${apiUrl}/api/places/maps-script?callback=${CALLBACK_NAME}&libraries=marker`;
  s.onerror = () => {
    s.remove();
    attempt += 1;
    if (attempt < MAX_ATTEMPTS) {
      setTimeout(() => injectScript(apiUrl), RETRY_DELAYS[attempt - 1]);
      return;
    }
    loadState = 'idle';
    console.error('[Maps] Failed to load Google Maps JS API after retries');
    subscribers.forEach(s => s.onError());
    subscribers = [];
  };
  document.head.appendChild(s);
}

function loadMaps(apiUrl: string, onReady: () => void, onError: () => void) {
  // Already in window (e.g. HMR reload) — sync the module state and call back
  if (window.google?.maps?.marker?.AdvancedMarkerElement) {
    loadState = 'ready';
    onReady();
    return;
  }
  if (loadState === 'ready') { onReady(); return; }

  subscribers.push({ onReady, onError });
  if (loadState === 'loading') return;
  loadState = 'loading';
  attempt   = 0;

  (window as any)[CALLBACK_NAME] = () => {
    loadState = 'ready';
    subscribers.forEach(s => s.onReady());
    subscribers = [];
  };

  injectScript(apiUrl);
}

// ── Reverse geocode ───────────────────────────────────────────────────────────

async function reverseGeocode(apiUrl: string, lat: number, lon: number): Promise<AddressDetails | null> {
  try {
    const res  = await fetch(`${apiUrl}/api/places/reverse?lat=${lat}&lon=${lon}`);
    const data = await res.json() as { success?: boolean; data?: AddressDetails };
    return data.success ? data.data ?? null : null;
  } catch { return null; }
}

// ── Red pin HTML element ──────────────────────────────────────────────────────

function makePinElement() {
  const el       = document.createElement('div');
  el.style.cssText = `
    width:32px; height:40px; cursor:grab;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,.4));
  `;
  el.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 40" width="32" height="40">
      <path d="M16 0C9.4 0 4 5.4 4 12c0 9 12 28 12 28S28 21 28 12C28 5.4 22.6 0 16 0z"
            fill="#c0392b" stroke="#fff" stroke-width="1.5"/>
      <circle cx="16" cy="12" r="5" fill="#fff"/>
    </svg>`;
  return el;
}

// ── Component ─────────────────────────────────────────────────────────────────

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ apiUrl, lat, lon, onLocationChange, onPinChange, allowGeolocation = true }) => {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef   = useRef<any>(null);

  const [ready,      setReady]      = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [locating,   setLocating]   = useState(false);
  const [geocoding,  setGeocoding]  = useState(false);
  const [gpsError,   setGpsError]   = useState('');

  // ── Load Maps SDK ────────────────────────────────────────────────────────────
  const beginLoad = useCallback(() => {
    setLoadFailed(false);
    loadMaps(apiUrl, () => setReady(true), () => setLoadFailed(true));
  }, [apiUrl]);

  useEffect(() => { beginLoad(); }, [beginLoad]);

  const callbacks = useRef({ onPinChange, onLocationChange });
  callbacks.current = { onPinChange, onLocationChange };
  const lookupSequence = useRef(0);
  const selectPin = useCallback(async (latitude: number, longitude: number) => {
    callbacks.current.onPinChange?.(latitude, longitude);
    if (!callbacks.current.onLocationChange) return;
    const sequence = ++lookupSequence.current;
    setGeocoding(true);
    const details = await reverseGeocode(apiUrl, latitude, longitude);
    if (sequence !== lookupSequence.current) return;
    setGeocoding(false);
    if (details) callbacks.current.onLocationChange?.(details);
  }, [apiUrl]);

  // ── Helper: create AdvancedMarkerElement at a position ──────────────────────
  const makeMarker = useCallback((position: { lat: number; lng: number }, map: any) => {
    const { AdvancedMarkerElement } = window.google.maps.marker;
    const marker = new AdvancedMarkerElement({
      position,
      map,
      gmpDraggable: true,
      content:      makePinElement(),
      title:        'Drag to adjust your exact location',
    });
    marker.addListener('dragend', async () => {
      const p = marker.position;
      await selectPin(p.lat, p.lng);
    });
    return marker;
  }, [selectPin]);

  // ── Init map once SDK ready ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    const center = lat && lon ? { lat, lng: lon } : NIGERIA_CENTER;
    const zoom   = lat && lon ? DEFAULT_ZOOM : COUNTRY_ZOOM;

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapId:            MAP_ID,
      disableDefaultUI: true,
      zoomControl:      true,
      gestureHandling:  'greedy',
    });

    if (lat && lon) {
      markerRef.current = makeMarker({ lat, lng: lon }, map);
    }

    map.addListener('click', async (e: any) => {
      const newLat = e.latLng.lat();
      const newLon = e.latLng.lng();
      if (markerRef.current) {
        markerRef.current.position = e.latLng;
      } else {
        markerRef.current = makeMarker({ lat: newLat, lng: newLon }, map);
      }
      map.panTo(e.latLng);
      await selectPin(newLat, newLon);
    });

    mapInstance.current = map;
  }, [ready, makeMarker]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync marker when address autocomplete picks a location ──────────────────
  useEffect(() => {
    if (!ready || !mapInstance.current) return;
    if (lat == null || lon == null) {
      if (markerRef.current) markerRef.current.map = null;
      markerRef.current = null;
      return;
    }
    const pos = { lat, lng: lon };
    if (markerRef.current) {
      markerRef.current.position = pos;
    } else {
      markerRef.current = makeMarker(pos, mapInstance.current);
    }
    mapInstance.current.panTo(pos);
    mapInstance.current.setZoom(DEFAULT_ZOOM);
  }, [lat, lon, ready, makeMarker]);

  // ── GPS ──────────────────────────────────────────────────────────────────────
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported by your browser');
      return;
    }
    setLocating(true);
    setGpsError('');

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const newLat = coords.latitude;
        const newLon = coords.longitude;
        setLocating(false);

        if (mapInstance.current && ready) {
          const pos = { lat: newLat, lng: newLon };
          if (markerRef.current) {
            markerRef.current.position = pos;
          } else {
            markerRef.current = makeMarker(pos, mapInstance.current);
          }
          mapInstance.current.setCenter(pos);
          mapInstance.current.setZoom(DEFAULT_ZOOM);
        }

        await selectPin(newLat, newLon);
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
  }, [ready, makeMarker, selectPin]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <Icon.PiMapTrifoldBold size={13} className="text-red-600" />
          Pin your exact location
          <span className="font-normal text-gray-400">(click map or drag pin)</span>
        </label>
        {allowGeolocation && <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating || !ready}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {locating
            ? <span className="w-3 h-3 rounded-full border-2 border-red-200 border-t-red-700 animate-spin" />
            : <Icon.PiNavigationArrowBold size={13} />}
          {locating ? 'Locating…' : 'Use my location'}
        </button>}
      </div>

      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div ref={mapRef} className="w-full h-[220px] bg-gray-100" />

        {!ready && !loadFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Loading map…</span>
            </div>
          </div>
        )}

        {loadFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <Icon.PiWarningCircle size={18} className="text-amber-500" />
              <span className="text-xs text-gray-500">Couldn&apos;t load the map</span>
              <button
                type="button"
                onClick={beginLoad}
                className="text-xs font-semibold text-red-700 hover:text-red-900"
              >
                Retry
              </button>
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
            {allowGeolocation ? 'Click the map or use your location' : 'Click the map to set the delivery pin'}
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
