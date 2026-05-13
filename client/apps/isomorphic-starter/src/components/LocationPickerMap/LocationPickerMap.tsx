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
  interface Window { L: any; }
}

const NIGERIA_CENTER: [number, number] = [9.0765, 7.3986]; // Abuja
const DEFAULT_ZOOM   = 16;
const COUNTRY_ZOOM   = 6;

// ── Leaflet CDN loader (idempotent) ──────────────────────────────────────────

let leafletState: 'idle' | 'loading' | 'ready' = 'idle';
const leafletCallbacks: Array<() => void> = [];

function loadLeaflet(callback: () => void) {
  if (leafletState === 'ready') { callback(); return; }
  leafletCallbacks.push(callback);
  if (leafletState === 'loading') return;
  leafletState = 'loading';

  // CSS
  const link  = document.createElement('link');
  link.rel    = 'stylesheet';
  link.href   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  // JS
  const script = document.createElement('script');
  script.src   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = () => {
    leafletState = 'ready';
    leafletCallbacks.forEach(cb => cb());
    leafletCallbacks.length = 0;
  };
  document.head.appendChild(script);
}

// ── Reverse geocode via our backend proxy ─────────────────────────────────────

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

  // ── Load Leaflet ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadLeaflet(() => setReady(true));
  }, []);

  // ── Init map once Leaflet is ready ──────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || mapInstance.current) return;

    const L      = window.L;
    const center = (lat && lon) ? [lat, lon] : NIGERIA_CENTER;
    const zoom   = (lat && lon) ? DEFAULT_ZOOM : COUNTRY_ZOOM;

    // Fix default marker icon paths broken by bundlers
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = L.map(mapRef.current, {
      center,
      zoom,
      zoomControl:       true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom:     19,
    }).addTo(map);

    // Custom red pin icon
    const redIcon = L.divIcon({
      className: '',
      html: `<div style="
        width:28px;height:36px;
        background:#c0392b;
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid #fff;
        box-shadow:0 2px 8px rgba(0,0,0,.35);
        position:relative;
      ">
        <div style="
          position:absolute;inset:4px;
          background:#fff;border-radius:50%;
        "></div>
      </div>`,
      iconSize:   [28, 36],
      iconAnchor: [14, 36],
    });

    const marker = lat && lon
      ? L.marker([lat, lon], { draggable: true, icon: redIcon }).addTo(map)
      : null;

    // Click on map → place/move pin
    map.on('click', async (e: any) => {
      const { lat: newLat, lng: newLon } = e.latlng;
      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLon]);
      } else {
        markerRef.current = L.marker([newLat, newLon], { draggable: true, icon: redIcon }).addTo(map);
        attachDragEnd(markerRef.current);
      }
      map.panTo([newLat, newLon]);
      setGeocoding(true);
      const details = await reverseGeocode(newLat, newLon);
      setGeocoding(false);
      if (details) onLocationChange(details);
    });

    function attachDragEnd(m: any) {
      m.on('dragend', async () => {
        const pos = m.getLatLng();
        setGeocoding(true);
        const details = await reverseGeocode(pos.lat, pos.lng);
        setGeocoding(false);
        if (details) onLocationChange(details);
      });
    }

    if (marker) {
      attachDragEnd(marker);
      markerRef.current = marker;
    }

    mapInstance.current = map;
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync marker when lat/lon change from outside ────────────────────────────
  useEffect(() => {
    if (!mapInstance.current || !ready) return;
    const L = window.L;

    if (lat && lon) {
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      } else {
        const redIcon = L.divIcon({
          className: '',
          html: `<div style="
            width:28px;height:36px;
            background:#c0392b;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            border:3px solid #fff;
            box-shadow:0 2px 8px rgba(0,0,0,.35);
            position:relative;
          ">
            <div style="
              position:absolute;inset:4px;
              background:#fff;border-radius:50%;
            "></div>
          </div>`,
          iconSize:   [28, 36],
          iconAnchor: [14, 36],
        });
        const marker = L.marker([lat, lon], { draggable: true, icon: redIcon }).addTo(mapInstance.current);
        marker.on('dragend', async () => {
          const pos = marker.getLatLng();
          setGeocoding(true);
          const details = await reverseGeocode(pos.lat, pos.lng);
          setGeocoding(false);
          if (details) onLocationChange(details);
        });
        markerRef.current = marker;
      }
      mapInstance.current.setView([lat, lon], DEFAULT_ZOOM);
    }
  }, [lat, lon, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── GPS ─────────────────────────────────────────────────────────────────────
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    setGpsError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLon = pos.coords.longitude;
        setLocating(false);

        if (mapInstance.current && ready) {
          const L = window.L;
          if (markerRef.current) {
            markerRef.current.setLatLng([newLat, newLon]);
          } else {
            const redIcon = L.divIcon({
              className: '',
              html: `<div style="width:28px;height:36px;background:#c0392b;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);position:relative;"><div style="position:absolute;inset:4px;background:#fff;border-radius:50%;"></div></div>`,
              iconSize: [28, 36], iconAnchor: [14, 36],
            });
            const marker = L.marker([newLat, newLon], { draggable: true, icon: redIcon }).addTo(mapInstance.current);
            marker.on('dragend', async () => {
              const p = marker.getLatLng();
              setGeocoding(true);
              const d = await reverseGeocode(p.lat, p.lng);
              setGeocoding(false);
              if (d) onLocationChange(d);
            });
            markerRef.current = marker;
          }
          mapInstance.current.setView([newLat, newLon], DEFAULT_ZOOM);
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

      {/* Map */}
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
