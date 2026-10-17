'use client';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { changeShoppingAccount, readShoppingSession, resolveShoppingLocation, validShoppingLocation } from './shopping-location';
import type { LocationState, ShoppingLocation } from './shopping-location';

interface ShoppingContext {
  location: ShoppingLocation | null; revision: string; addresses: ShoppingLocation[];
  loading: boolean; error: string | null;
  accountKey: string; addressesLoading: boolean; addressError: string | null;
  retryAddresses: () => void; applyLocation: (candidate: ShoppingLocation | null) => boolean;
  selectDelivery: (address: ShoppingLocation) => void;
  requestCurrentLocation: () => void; clearLocation: () => void;
}
const Context = createContext<ShoppingContext | null>(null);
const SESSION_KEY = 'dh_shopping_location';
const empty: LocationState = { accountId: null, explicit: null, defaultDelivery: null, current: null };
export function ShoppingLocationProvider({ children }: { children: React.ReactNode }) {
  const { user, token, isLoading } = useAuth();
  const accountId = user?._id || user?.id || null;
  const [state, setState] = useState<LocationState>(empty);
  const [addresses, setAddresses] = useState<ShoppingLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressAttempt, setAddressAttempt] = useState(0);
  const initialized = useRef(false);
  const geolocationRevision = useRef(0);
  const currentAccount = useRef(accountId);
  currentAccount.current = accountId;
  useEffect(() => {
    if (isLoading) return;
    geolocationRevision.current++;
    setState(previous => {
      let next = changeShoppingAccount(previous, accountId);
      if (!initialized.current) {
        initialized.current = true;
        let saved: ShoppingLocation | null = null;
        try { saved = readShoppingSession(sessionStorage.getItem(SESSION_KEY)); } catch { /* Storage may be disabled. */ }
        next = changeShoppingAccount({ ...next, explicit: saved, current: null }, accountId);
      }
      return next;
    });
    setAddresses([]);
    setError(null); setAddressError(null);
    if (!token || !accountId) { setLoading(false); setAddressesLoading(false); return; }
    const controller = new AbortController();
    setLoading(true); setAddressesLoading(true);
    void fetchWithAuth(API_URL + '/api/addresses', { signal: controller.signal }).then(async res => {
      if (!res.ok) throw new Error('Saved addresses could not be loaded. You can enter an address.');
      const data = await res.json();
      const raw: unknown[] = data.data?.addresses || data.addresses || [];
      const choices = raw.flatMap(value => {
        if (!value || typeof value !== 'object') return [];
        const row = value as Record<string, unknown>;
        const coords = row.coordinates as { lat?: number; lng?: number; lon?: number } | null;
        const candidate = { lat: coords?.lat, lon: coords?.lng ?? coords?.lon,
          label: [row.addressLine1 || row.address, row.city, row.state].filter(Boolean).join(', '),
          source: 'delivery', addressId: String(row._id), ownerId: accountId };
        return validShoppingLocation(candidate) ? [{ ...candidate, isDefault: row.isDefaultShipping === true || row.isDefault === true }] : [];
      });
      if (controller.signal.aborted || currentAccount.current !== accountId) return;
      setAddresses(choices);
      setState(previous => ({ ...previous, defaultDelivery: choices.find(row => row.isDefault) || null }));
    }).catch(cause => {
      if (!controller.signal.aborted) {
        const message = cause instanceof Error ? cause.message : 'Unable to load saved addresses';
        setError(message); setAddressError(message);
      }
    }).finally(() => { if (!controller.signal.aborted) { setLoading(false); setAddressesLoading(false); } });
    return () => controller.abort();
  }, [accountId, token, isLoading, addressAttempt]);
  const location = resolveShoppingLocation(changeShoppingAccount(state, accountId));
  useEffect(() => {
    if (!initialized.current) return;
    const explicit = state.explicit || state.current;
    try {
      if (explicit) sessionStorage.setItem(SESSION_KEY, JSON.stringify(explicit));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch { /* Selection remains usable without storage. */ }
  }, [state.explicit, state.current]);
  const value = useMemo<ShoppingContext>(() => ({
    location, revision: location ? [location.lat, location.lon, location.source].join(':') : '',
    addresses, loading, error, accountKey: accountId || 'guest', addressesLoading, addressError,
    retryAddresses() { setAddressAttempt(value => value + 1); },
    applyLocation(candidate) {
      if (candidate && (!validShoppingLocation(candidate) || (candidate.ownerId && candidate.ownerId !== accountId))) return false;
      geolocationRevision.current++; setLoading(false); setError(null);
      setState(previous => ({ ...previous,
        explicit: candidate ? { ...candidate, ownerId: accountId || undefined } : null,
        defaultDelivery: null, current: null,
      }));
      return true;
    },
    selectDelivery(address) {
      if (!validShoppingLocation(address)) return;
      geolocationRevision.current++; setLoading(false);
      setError(null);
      setState(previous => ({ ...previous, explicit: { ...address, source: 'delivery', ownerId: accountId || undefined } }));
    },
    clearLocation() { geolocationRevision.current++; setLoading(false); setState(previous => ({ ...previous, explicit: null, defaultDelivery: null, current: null })); setError(null); },
    requestCurrentLocation() {
      if (location?.source === 'delivery') { setError('Your delivery address takes priority. Clear it first to use your current location.'); return; }
      if (!navigator.geolocation) { setError('Current location is unavailable. Please enter an address.'); return; }
      const requestId = ++geolocationRevision.current;
      setLoading(true); setError(null);
      navigator.geolocation.getCurrentPosition(position => {
        if (requestId !== geolocationRevision.current) return;
        setState(previous => ({ ...previous, current: {
          lat: position.coords.latitude, lon: position.coords.longitude, label: 'Current location', source: 'current',
        } }));
        setLoading(false);
      }, () => { if (requestId !== geolocationRevision.current) return; setError('Location access is unavailable. You can enter a delivery address.'); setLoading(false); },
      { timeout: 10000, maximumAge: 60000 });
    },
  }), [location?.lat, location?.lon, location?.label, location?.source, addresses, loading, error, accountId, addressesLoading, addressError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useShoppingLocation() {
  const value = useContext(Context);
  if (!value) throw new Error('ShoppingLocationProvider is required');
  return value;
}
