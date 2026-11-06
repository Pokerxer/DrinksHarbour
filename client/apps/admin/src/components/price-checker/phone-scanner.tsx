'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Reader {
  start: (
    camera: unknown,
    options: unknown,
    onDecode: (code: string) => void,
    onError?: (message: string) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  clear: () => void;
  applyVideoConstraints?: (constraints: unknown) => Promise<void>;
}

interface TorchState {
  supported: boolean;
  on: boolean;
}

/** Relays each decoded code to the page, which asks the API for the price
 *  and shares it with the paired kiosk screen. */
export function PhoneScanner({
  slug,
  session,
  onScan,
}: {
  slug: string;
  session: string;
  onScan: (code: string) => void;
}) {
  const [status, setStatus] = useState<'ready' | 'starting' | 'denied'>('ready');
  const [torch, setTorch] = useState<TorchState>({ supported: false, on: false });
  const readerRef = useRef<Reader | null>(null);
  const last = useRef({ code: '', at: 0 });
  const decode = useCallback(
    (code: string) => {
      const value = code.trim();
      if (value.length < 5) return;
      const now = Date.now();
      if (last.current.code === value && now - last.current.at < 700) return;
      last.current = { code: value, at: now };
      onScan(value);
    },
    [onScan]
  );
  useEffect(() => {
    const reader = readerRef.current;
    void reader?.stop().catch(() => {});
    reader?.clear();
  }, []);
  const start = useCallback(async () => {
    if (readerRef.current) return;
    setStatus('starting');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const reader = new Html5Qrcode('phone-reader') as unknown as Reader;
      readerRef.current = reader;
      await reader.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        decode,
        () => {}
      );
      setStatus('ready');
      // Torch probe: capability-capable browsers keep the toggle; the rest
      // honestly hide it. A probe failure never breaks scanning.
      if (reader.applyVideoConstraints)
        try {
          await reader.applyVideoConstraints({ advanced: [{ torch: false }] });
          setTorch({ supported: true, on: false });
        } catch {
          setTorch({ supported: false, on: false });
        }
      else setTorch({ supported: false, on: false });
    } catch (error) {
      readerRef.current = null;
      setStatus(
        error instanceof Error && /permission|denied/i.test(error.message)
          ? 'denied'
          : 'ready'
      );
    }
  }, [decode]);
  const toggleTorch = useCallback(async () => {
    const reader = readerRef.current;
    if (!reader?.applyVideoConstraints) return;
    try {
      await reader.applyVideoConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch((state) => ({ supported: true, on: !state.on }));
    } catch {
      /* dim store, no torch — the scanner keeps working */
    }
  }, [torch.on]);
  return (
    <section className="phone-scanner" aria-label="Camera scanner">
      <button className="phone-start" onClick={() => void start()}>
        Start camera
      </button>
      <div className="phone-viewfinder">
        <div id="phone-reader" />
        <span className="phone-corner tl" aria-hidden="true" />
        <span className="phone-corner tr" aria-hidden="true" />
        <span className="phone-corner bl" aria-hidden="true" />
        <span className="phone-corner br" aria-hidden="true" />
      </div>
      {status === 'ready' && (
        <p className="phone-hint">Align the barcode inside the box</p>
      )}
      {torch.supported && (
        <button
          className="phone-torch"
          aria-label="Toggle torch"
          onClick={() => void toggleTorch()}
        >
          {torch.on ? 'Torch on 🔆' : 'Toggle torch 🔆'}
        </button>
      )}
      {status === 'starting' && <p role="status">Opening camera…</p>}
      {status === 'denied' && (
        <p role="alert">Allow camera access in your browser to scan bottles.</p>
      )}
    </section>
  );
}
