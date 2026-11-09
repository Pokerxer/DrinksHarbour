'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { validBarcode } from './scanner';

interface ZoomRange {
  min: number;
  max: number;
}

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
  getRunningTrackCapabilities?: () => { zoom?: ZoomRange };
}

interface TorchState {
  supported: boolean;
  on: boolean;
}

/** Bottle/label symbologies — the phone page never needs to read QR codes. */
const supports = async () => {
  try {
    const { Html5QrcodeSupportedFormats } = await import('html5-qrcode');
    return [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
    ];
  } catch {
    return undefined; // decoder without the enum still runs with defaults
  }
};

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
  const [flash, setFlash] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [zoom, setZoomState] = useState<ZoomRange | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [dimHint, setDimHint] = useState(false);
  const [nightOn, setNightOn] = useState(false);
  const decoded = useRef(false);
  const readerRef = useRef<Reader | null>(null);
  const last = useRef({ code: '', at: 0 });
  const decode = useCallback(
    (code: string) => {
      const value = code.trim();
      if (value.length < 5) return;
      const now = Date.now();
      if (last.current.code === value && now - last.current.at < 700) return;
      last.current = { code: value, at: now };
      decoded.current = true;
      setDimHint(false);
      // Capture feedback: haptic + light sweep + confirmation pill. Never
      // fires twice for the same read (the dedupe guard above runs first).
      navigator.vibrate?.(40);
      setFlash(true);
      setCaptured(true);
      window.setTimeout(() => setFlash(false), 300);
      window.setTimeout(() => setCaptured(false), 900);
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
        {
          fps: 15,
          // 1-D bottle codes are long and thin — a wide horizontal band
          // avoids clipping EAN-13/UPC symbols that square finders miss.
          qrbox: { width: 300, height: 140 },
          videoConstraints: {
            width: { ideal: 1280 },
            height: { ideal: 960 },
            facingMode: 'environment',
          },
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          // Formats decoded in this flow (normalised per engine).
          ...(await supports().then((formats) =>
            formats ? { formatsToSupport: formats } : {}
          )),
        },
        decode,
        () => {}
      );
      setStatus('ready');
      // Dim-store assist: 15s of no capture while the camera ran ⇒ hint.
      window.setTimeout(() => {
        setDimHint((hint) => hint || !decoded.current);
      }, 15_000);
      const caps = reader.getRunningTrackCapabilities?.();
      if (caps?.zoom?.max) setZoomState({ min: caps.zoom.min ?? 1, max: caps.zoom.max });
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
  const enableNight = useCallback(async () => {
    const reader = readerRef.current;
    setNightOn(true);
    setDimHint(false);
    if (!reader?.applyVideoConstraints) return;
    try {
      await reader.applyVideoConstraints({ advanced: [{ torch: true }] });
      setTorch({ supported: true, on: true });
    } catch {
      /* no torch — exposure boost alone still helps */
    }
    try {
      await reader.applyVideoConstraints({
        advanced: [{ exposureCompensation: 2 }],
      });
    } catch {
      /* camera refuses the boost — torch already did the heavy lifting */
    }
  }, []);
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
  const moveZoom = useCallback(async (value: string) => {
    const number = Number(value);
    const reader = readerRef.current;
    if (!reader?.applyVideoConstraints || !Number.isFinite(number)) return;
    try {
      await reader.applyVideoConstraints({ advanced: [{ zoom: number }] });
      setZoomLevel(number);
    } catch {
      /* zoom fallback — keep scanning */
    }
  }, []);
  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const value = validBarcode(manualCode);
    if (!value) return;
    setManualCode('');
    decode(value); // same dedupe path as the camera decoder
  };
  return (
    <section className="phone-scanner" aria-label="Camera scanner">
      <button
        className="phone-start"
        onClick={() => void start()}
        disabled={status === 'starting'}
      >
        Start camera
      </button>
      <div className={`phone-viewfinder${flash ? ' phone-flashing' : ''}`}>
        <div id="phone-reader" />
        <span className="phone-corner tl" aria-hidden="true" />
        <span className="phone-corner tr" aria-hidden="true" />
        <span className="phone-corner bl" aria-hidden="true" />
        <span className="phone-corner br" aria-hidden="true" />
        {flash && <span className="phone-sweep" aria-hidden="true" />}
      </div>
      {captured && (
        <p className="phone-captured" role="status">
          ✓ Scanned
        </p>
      )}
      {status === 'ready' && (
        <p className="phone-hint">Align the barcode inside the box</p>
      )}
      {torch.supported && (
        <button
          className="phone-torch"
          aria-label="Toggle torch"
          onClick={() => void toggleTorch()}
        >
          {torch.on ? 'Torch on' : 'Toggle torch'}
        </button>
      )}
      {dimHint && (
        <div className="phone-night" role="status">
          <span>Dim store?</span>
          <button className="phone-night-enable" onClick={() => void enableNight()}>
            Night mode
          </button>
        </div>
      )}
      {nightOn && <p className="phone-toned">Night mode on</p>}
      {zoom && (
        <label className="phone-zoom">
          <span>Zoom</span>
          <input
            type="range"
            aria-label="Zoom"
            min={zoom.min}
            max={zoom.max}
            step="0.1"
            value={zoomLevel}
            onChange={(event) => void moveZoom(event.target.value)}
          />
        </label>
      )}
      {manual ? (
        <form className="phone-manual" onSubmit={submitManual}>
          <label htmlFor="phone-manual-barcode">Barcode</label>
          <input
            id="phone-manual-barcode"
            value={manualCode}
            maxLength={128}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => setManualCode(event.target.value)}
          />
          <button type="submit" className="phone-start phone-manual-check">
            Check price
          </button>
        </form>
      ) : (
        <button
          className="phone-quiet-button"
          aria-expanded={false}
          onClick={() => setManual(true)}
        >
          Type barcode
        </button>
      )}
      {status === 'starting' && <p role="status">Opening camera…</p>}
      {status === 'denied' && (
        <p role="alert">Allow camera access in your browser to scan bottles.</p>
      )}
    </section>
  );
}
