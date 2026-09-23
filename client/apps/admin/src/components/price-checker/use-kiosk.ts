'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { checkPrice, KioskError, openKiosk } from './api';
import { createScanner, latestScan, validBarcode } from './scanner';
import type { KioskConfig, KioskProduct, Screen } from './types';
export function useKiosk(slug: string) {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [product, setProduct] = useState<KioskProduct | null>(null);
  const [screen, setScreen] = useState<Screen>('initializing');
  const [remaining, setRemaining] = useState(0);
  const latest = useRef(latestScan());
  const pending = useRef<AbortController | null>(null);
  const last = useRef({ code: '', at: 0 });
  const fail = useCallback((error: unknown) => {
    if (error instanceof Error && error.name === 'AbortError') return;
    setScreen(
      error instanceof KioskError && [403, 404].includes(error.status) ? 'closed' : 'offline'
    );
  }, []);
  const initialize = useCallback(async () => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const generation = latest.current.begin();
    setRemaining(0);
    setProduct(null);
    setScreen('initializing');
    try {
      const next = await openKiosk(slug, controller.signal);
      if (latest.current.isCurrent(generation)) {
        setConfig(next);
        setScreen('idle');
      }
    } catch (error) {
      if (latest.current.isCurrent(generation)) fail(error);
    }
  }, [slug, fail]);
  useEffect(() => {
    void initialize();
    return () => {
      latest.current.begin();
      pending.current?.abort();
    };
  }, [initialize]);
  useEffect(() => {
    const reconnect = () => {
      if (screen === 'offline') void initialize();
    };
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [screen, initialize]);
  const scan = useCallback(
    async (input: string) => {
      const code = validBarcode(input);
      if (!code) return;
      const now = Date.now();
      if (last.current.code === code && now - last.current.at < 700) return;
      last.current = { code, at: now };
      setRemaining(0);
      setProduct(null);
      setScreen('loading');
      pending.current?.abort();
      const controller = new AbortController();
      pending.current = controller;
      const generation = latest.current.begin();
      try {
        const result = await checkPrice(slug, code, crypto.randomUUID(), controller.signal);
        if (!latest.current.isCurrent(generation)) return;
        setConfig(result.config);
        setProduct(result.product || null);
        setScreen(
          result.found ? 'result' : result.status === 'NOT_FOUND' ? 'missing' : 'unavailable'
        );
      } catch (error) {
        if (latest.current.isCurrent(generation)) fail(error);
      }
    },
    [slug, fail]
  );
  const reset = useCallback(() => {
    latest.current.begin();
    pending.current?.abort();
    setProduct(null);
    setRemaining(0);
    setScreen('idle');
  }, []);
  useEffect(() => {
    if (!['result', 'missing', 'unavailable'].includes(screen) || !config) return;
    const generation = latest.current.begin();
    const deadline = Date.now() + config.settings.resetSeconds * 1000;
    setRemaining(config.settings.resetSeconds);
    const timer = window.setInterval(() => {
      if (!latest.current.isCurrent(generation)) return;
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds) reset();
    }, 200);
    return () => clearInterval(timer);
  }, [screen, product, config, reset]);
  useEffect(() => {
    const scanner = createScanner();
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      const code = scanner.feed(event.key, performance.now());
      if (code) {
        event.preventDefault();
        void scan(code);
      }
    };
    const focus = () => scanner.clear();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('focus', focus);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('focus', focus);
    };
  }, [scan]);
  return { config, product, screen, remaining, scan, reset, initialize };
}
