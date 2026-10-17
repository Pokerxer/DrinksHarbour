'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { priceCheckerApi as api } from '@/services/priceChecker.service';
import { kioskUrl } from './form-utils';
import type { Kiosk, KioskOptions } from './types';

export function useDashboard(token: string) {
  const [items, setItems] = useState<Kiosk[]>([]);
  const [options, setOptions] = useState<KioskOptions | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!token || writing.current) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setLoadError('');
    try {
      const [rows, choices] = await Promise.all([
        api.list(token, controller.signal),
        api.options(token, controller.signal),
      ]);
      if (controller.signal.aborted || !alive.current) return;
      setItems(rows);
      setOptions(choices);
      setLoaded(true);
    } catch (error) {
      if (!controller.signal.aborted && alive.current)
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load kiosks.'
        );
    } finally {
      if (!controller.signal.aborted && alive.current) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      pending.current?.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function change(kiosk: Kiosk, remove = false) {
    if (!token || writing.current) return;
    if (
      remove &&
      !window.confirm(
        `Delete “${kiosk.name}”? Its screen will stop working. Scan history will be retained.`
      )
    )
      return;
    writing.current = true;
    pending.current?.abort();
    setLoading(false);
    setBusyId(kiosk._id);
    setActionError('');
    setNotice('');
    try {
      if (remove) {
        await api.remove(kiosk._id, token);
        if (!alive.current) return;
        setItems((rows) => rows.filter((row) => row._id !== kiosk._id));
        setNotice('Kiosk deleted. Scan history is retained.');
      } else {
        const updated = await api.update(
          kiosk._id,
          { enabled: !kiosk.enabled },
          token
        );
        if (!alive.current) return;
        setItems((rows) =>
          rows.map((row) => (row._id === updated._id ? updated : row))
        );
        setNotice(
          `${updated.name} ${updated.enabled ? 'enabled' : 'disabled'}.`
        );
      }
    } catch (error) {
      if (alive.current)
        setActionError(
          error instanceof Error ? error.message : 'Unable to update kiosk.'
        );
    } finally {
      writing.current = false;
      if (alive.current) setBusyId(null);
    }
  }

  async function copy(kiosk: Kiosk) {
    setActionError('');
    setNotice('');
    try {
      await navigator.clipboard.writeText(kioskUrl(kiosk.slug));
      if (alive.current) setNotice(`Link copied for ${kiosk.name}.`);
    } catch {
      if (alive.current)
        setActionError(
          'Copy is unavailable. Open the kiosk and copy its address.'
        );
    }
  }
  return {
    items,
    options,
    loading,
    loaded,
    loadError,
    actionError,
    notice,
    busyId,
    load,
    change,
    copy,
  };
}
