'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { checkPrice, KioskError, openKiosk } from './api';
import { createScanner, latestScan, validBarcode } from './scanner';
import type { KioskConfig, KioskProduct, Screen } from './types';

export interface OfflineSupport {
  /** When the cached pricebook was generated (drives the offline badge). */
  generatedAt: string;
  /** Cached public kiosk config so a cold offline boot can still render. */
  config?: KioskConfig;
  /** Local barcode → product resolution against the cached book. */
  lookup: (barcode: string) => KioskProduct | null;
  /** Called for every scan served offline, for the local queue. */
  onOfflineScan?: (record: { barcode: string; requestId: string; scannedAt: string }) => void;
}

export function useKiosk(slug: string, offline?: OfflineSupport) {
  const [config, setConfig] = useState<KioskConfig | null>(null);
  const [product, setProduct] = useState<KioskProduct | null>(null);
  const [screen, setScreen] = useState<Screen>('initializing');
  const [remaining, setRemaining] = useState(0);
  const [offlineState, setOfflineState] = useState(false);
  const latest = useRef(latestScan());
  const pending = useRef<AbortController | null>(null);
  const last = useRef({ code: '', at: 0 });
  const sessionReady = useRef(false);
  const offlineRef = useRef(offline);
  offlineRef.current = offline;
  const fail = useCallback((error: unknown) => {
    if (error instanceof Error && error.name === 'AbortError') return;
    if (error instanceof KioskError && [403, 404].includes(error.status))
      sessionReady.current = false;
    setScreen(
      error instanceof KioskError && [403, 404].includes(error.status)
        ? 'closed'
        : 'offline'
    );
  }, []);
  const initialize = useCallback(async () => {
    sessionReady.current = false;
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
        sessionReady.current = true;
        setConfig(next);
        setOfflineState(false);
        setScreen('idle');
      }
    } catch (error) {
      if (!latest.current.isCurrent(generation)) return;
      const unreachable =
        error instanceof KioskError && [502, 503, 504].includes(error.status);
      if (unreachable && offlineRef.current?.config) {
        // Cold boot with no connectivity: render from the cached book.
        sessionReady.current = true;
        setConfig(offlineRef.current.config);
        setOfflineState(true);
        setScreen('idle');
        return;
      }
      fail(error);
    }
  }, [slug, fail]);
  useEffect(() => {
    void initialize();
    return () => {
      sessionReady.current = false;
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
      if (!sessionReady.current) return;
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
      let settled = false;
      try {
        const result = await checkPrice(
          slug,
          code,
          crypto.randomUUID(),
          controller.signal
        );
        if (!latest.current.isCurrent(generation)) return;
        settled = true;
        setConfig(result.config);
        setOfflineState(false);
        setProduct(result.product || null);
        setScreen(
          result.found
            ? 'result'
            : result.status === 'NOT_FOUND'
              ? 'missing'
              : 'unavailable'
        );
      } catch (error) {
        if (!latest.current.isCurrent(generation)) return;
        // Network loss: serve the cached pricebook when the offline support
        // is wired up. A cached hit still queues a scan record for sync.
        const unreachable =
          error instanceof KioskError &&
          [502, 503, 504].includes(error.status);
        if (!settled && unreachable && offlineRef.current) {
          const cached = offlineRef.current.lookup(code);
          setOfflineState(true);
          if (cached) {
            offlineRef.current.onOfflineScan?.({
              barcode: code,
              requestId: crypto.randomUUID(),
              scannedAt: new Date().toISOString(),
            });
            setProduct(cached);
            setScreen('result');
            return;
          }
          setProduct(null);
          setScreen('missing');
          return;
        }
        if (!settled) fail(error);
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
  // Enter the bottle-comparison view from the idle or result screens. The
  // compare screen joins the auto-reset countdown, so an idle kiosk returns
  // to the welcome screen (tray intact) without any customer action.
  const openCompare = useCallback(() => {
    if (!sessionReady.current) return;
    latest.current.begin();
    pending.current?.abort();
    setRemaining(0);
    setScreen((current) =>
      ['idle', 'result', 'compare'].includes(current) ? 'compare' : current
    );
  }, []);
  useEffect(() => {
    if (!['result', 'missing', 'unavailable', 'compare'].includes(screen) || !config)
      return;
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
    const scanner = createScanner({
      idleDecodeMs: 120,
      onIdleDecode: (code) => void scan(code),
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input,textarea,select,[contenteditable="true"]'))
        return;
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
  return {
    config,
    product,
    screen,
    remaining,
    scan,
    reset,
    initialize,
    openCompare,
    offline: offlineState,
  };
}
