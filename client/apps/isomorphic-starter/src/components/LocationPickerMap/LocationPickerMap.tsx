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
    initGoogleMapsLocationPicker?: () => void;
  }
}

const NIGERIA_CENTER = { lat: 9.0765, lng: 7.3986 }; // Abuja
const DEFAULT_ZOOM   = 15;
const COUNTRY_ZOOM   = 6;

async function reverseGeocode(lat: number, lon: number): Promise<AddressDetails | null> {
  try {
    const res  = await fetch(`${API_URL}/api/places/reverse?lat=${lat}&lon=${lon}`);
    const data = await res.json();
    return data.success ? data.data : null;
  } catch {
    return null;
  }
}

let mapsLoaded  = false;
let mapsLoading = false;
const mapsCallbacks: (() => void)[] = [];

function loadGoogleMaps(apiKey: string, callback: () => void) {
  if (mapsLoaded) { callback(); return; }
  mapsCallbacks.push(callback);
  if (mapsLoading) return;
  mapsLoading = true;

  window.initGoogleMapsLocationPicker = () => {
    mapsLoaded = true;
    mapsLoading = false;
    mapsCallbacks.forEach(cb => cb());
    mapsCallbacks.length = 0;
  };

  const script     = document.createElement('script');
  script.src       = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initGoogleMapsLocationPicker&loading=async`;
  script.async     = true;
  script.defer     = true;
  document.head.appendChild(script);
}

const LocationPickerMap: React.FC<LocationPickerMapProps> = ({ lat, lon, onLocationChange }) => {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef   = useRef<any>(null);
  const [ready,     setReady]     = useState(false);
  const [locating,  setLocating]  = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [gpsError,  setGpsError]  = useState('');

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  // ── Load Google Maps ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) return;
    loadGoogleMaps(apiKey, () => setReady(true));
  }, [apiKey]);

  // ── Init map once SDK is ready ─────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (mapInstance.current) return; // already initialized

    const center = (lat && lon) ? { lat, lng: lon } : NIGERIA_CENTER;
    const zoom   = (lat && lon) ? DEFAULT_ZOOM : COUNTRY_ZOOM;

    const map = new window.google.maps.Map(mapRef.current, {
      center,
      zoom,
      disableDefaultUI:    true,
      zoomControl:         true,
      mapTypeControl:      false,
      streetViewControl:   false,
      fullscreenControl:   false,
      gestureHandling:     'greedy',
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });

    const marker = new window.google.maps.Marker({
      position: center,
      map,
      draggable: true,
      visible:   !!(lat && lon),
      icon: {
        path:        window.google.maps.SymbolPath.CIRCLE,
        scale:       10,
        fillColor:   '#c0392b',
        fillOpacity: 1,
        strokeColor: '#fff',
        strokeWeight: 2.5,
      },
    });

    // Click on map → place/move pin
    map.addListener('click', async (e: any) => {
      const newLat = e.latLng.lat();
      const newLon = e.latLng.lng();
      marker.setPosition(e.latLng);
      marker.setVisible(true);
      setGeocoding(true);
      const details = await reverseGeocode(newLat, newLon);
      setGeocoding(false);
      if (details) onLocationChange(details);
    });

    // Drag end → reverse geocode
    marker.addListener('dragend', async () => {
      const pos    = marker.getPosition();
      const newLat = pos.lat();
      const newLon = pos.lng();
      setGeocoding(true);
      const details = await reverseGeocode(newLat, newLon);
      setGeocoding(false);
      if (details) onLocationChange(details);
    });

    mapInstance.current = map;
    markerRef.current   = marker;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync marker when lat/lon change from outside (address autocomplete) ───
  useEffect(() => {
    if (!mapInstance.current || !markerRef.current) return;
    if (lat && lon) {
      const pos = new window.google.maps.LatLng(lat, lon);
      markerRef.current.setPosition(pos);
      markerRef.current.setVisible(true);
      mapInstance.current.panTo(pos);
      mapInstance.current.setZoom(DEFAULT_ZOOM);
    }
  }, [lat, lon]);

  // ── GPS: use current location ─────────────────────────────────────────────
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation not supported by your browser');
      return;
    }
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        setLocating(false);

        if (mapInstance.current && markerRef.current) {
          const latLng = new window.google.maps.LatLng(newLat, newLon);
          markerRef.current.setPosition(latLng);
          markerRef.current.setVisible(true);
          mapInstance.current.panTo(latLng);
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
            ? 'Location access denied — please allow it in your browser settings'
            : 'Could not get your location. Try again or pin manually.',
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [onLocationChange]);

  if (!apiKey) return null;

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
          <Icon.PiMapTrifoldBold size={13} className="text-red-600" />
          Pin your exact location
          <span className="font-normal text-gray-400">(drag pin or click map)</span>
        </label>
        <button
          type="button"
          onClick={handleLocateMe}
          disabled={locating || !ready}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:text-red-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {locating
            ? <span className="w-3 h-3 rounded-full border-2 border-red-200 border-t-red-700 animate-spin" />
            : <Icon.PiNavigationArrowBold size={13} />
          }
          {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>

      {/* Map container */}
      <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div ref={mapRef} className="w-full h-[220px] bg-gray-100" />

        {/* Loading overlay */}
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-2 border-gray-200 border-t-red-600 rounded-full animate-spin" />
              <span className="text-xs text-gray-400">Loading map…</span>
            </div>
          </div>
        )}

        {/* Geocoding overlay */}
        {geocoding && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-xs text-gray-600 font-medium px-3 py-1.5 rounded-full shadow flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-gray-200 border-t-gray-600 animate-spin" />
            Getting address…
          </div>
        )}

        {/* Hint if no pin yet */}
        {ready && !(lat && lon) && !geocoding && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm text-xs text-gray-500 px-3 py-1.5 rounded-full shadow whitespace-nowrap">
            Click the map or use "Use my location"
          </div>
        )}
      </div>

      {/* GPS error */}
      {gpsError && (
        <p className="text-xs text-amber-600 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} /> {gpsError}
        </p>
      )}
    </div>
  );
};

export default LocationPickerMap;
