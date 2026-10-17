'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ShoppingLocation } from '../../context/shopping-location';
import { previewCurrentLocation } from './current-location';

export function useLocationDraft(initial: ShoppingLocation | null, accountKey: string) {
  const [draft, updateDraft] = useState(initial);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const edited = useRef(false);
  const account = useRef(accountKey);
  useEffect(() => {
    if (account.current !== accountKey) {
      account.current = accountKey;
      edited.current = false;
      pending.current?.abort();
      setLocating(false); setLocationError(null);
    }
    if (!edited.current) updateDraft(initial);
  }, [accountKey, initial]);
  useEffect(() => () => pending.current?.abort(), []);
  const setDraft = useCallback((value: ShoppingLocation | null) => {
    edited.current = true;
    pending.current?.abort();
    updateDraft(value); setLocating(false); setLocationError(null);
  }, []);
  const locate = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLocating(true); setLocationError(null);
    try {
      const found = await previewCurrentLocation(controller.signal);
      if (controller.signal.aborted) return;
      edited.current = true; updateDraft(found);
    } catch (error) {
      if (!controller.signal.aborted) setLocationError(error instanceof Error ? error.message : 'Please enter an address.');
    } finally {
      if (!controller.signal.aborted) setLocating(false);
    }
  }, []);
  return { draft, setDraft, locating, locationError, locate };
}
