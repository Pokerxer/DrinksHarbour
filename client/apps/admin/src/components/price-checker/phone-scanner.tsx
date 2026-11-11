'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readPhoneFrame } from './phone-capture';
import { validBarcode } from './scanner';

type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number; step?: number };
};
type CameraControls = MediaTrackConstraintSet & {
  torch?: boolean;
  zoom?: number;
  exposureCompensation?: number;
};

export function PhoneScanner({ onScan, onCameraChange, busy = false }: {
  onScan: (code: string) => void;
  onCameraChange?: (active: boolean) => void;
  busy?: boolean;
}) {
  const [status, setStatus] = useState<'ready' | 'opening' | 'live' | 'failed'>('ready');
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [capabilities, setCapabilities] = useState<CameraCapabilities>({});
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [dimHint, setDimHint] = useState(false);
  const [manual, setManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const captureLock = useRef(false);
  const dimTimer = useRef<number | undefined>(undefined);
  const startButton = useRef<HTMLButtonElement>(null);

  const release = useCallback(() => {
    generation.current += 1;
    captureLock.current = false;
    window.clearTimeout(dimTimer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);
  useEffect(() => release, [release]);

  async function start() {
    if (status === 'opening' || !video.current) return;
    const player = video.current;
    const run = ++generation.current;
    setError('');
    setManual(false);
    setStatus('opening');
    onCameraChange?.(true);
    try {
      const opened = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      if (run !== generation.current) {
        opened.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = opened;
      player.srcObject = opened;
      await player.play();
      if (run !== generation.current) return;
      const track = opened.getVideoTracks()[0];
      const next = (track?.getCapabilities?.() || {}) as CameraCapabilities;
      setCapabilities(next);
      const actual = track?.getSettings?.() as (MediaTrackSettings & { zoom?: number }) | undefined;
      setZoom(actual?.zoom ?? next.zoom?.min ?? 1);
      setStatus('live');
      dimTimer.current = window.setTimeout(() => setDimHint(true), 15000);
    } catch {
      if (run !== generation.current) return;
      release();
      setStatus('failed');
      onCameraChange?.(false);
    }
  }

  function stop() {
    release();
    setStatus('ready');
    setReading(false);
    setError('');
    setTorch(false);
    setDimHint(false);
    onCameraChange?.(false);
    window.requestAnimationFrame(() => startButton.current?.focus());
  }

  function submit(code: string) {
    setError('');
    navigator.vibrate?.(40);
    onScan(code);
  }

  async function capture() {
    if (busy || captureLock.current || !video.current) return;
    const run = generation.current;
    captureLock.current = true;
    setReading(true);
    setError('');
    try {
      const barcode = await readPhoneFrame(video.current);
      if (run !== generation.current) return;
      if (!barcode) throw new Error('Barcode missing');
      window.clearTimeout(dimTimer.current);
      setDimHint(false);
      submit(barcode);
    } catch {
      if (run === generation.current) {
        setError('No barcode read. Hold the label steady and try again.');
      }
    } finally {
      if (run === generation.current) {
        captureLock.current = false;
        setReading(false);
      }
    }
  }

  async function changeCamera(controls: CameraControls) {
    const track = stream.current?.getVideoTracks()[0];
    if (!track?.applyConstraints) return false;
    try {
      await track.applyConstraints({ advanced: [controls] });
      return track === stream.current?.getVideoTracks()[0];
    } catch {
      return false;
    }
  }

  const active = status === 'opening' || status === 'live';
  return (
    <section className="phone-scanner" aria-label="Camera scanner">
      {!active && (
        <button ref={startButton} className="phone-start" type="button" onClick={() => void start()}>
          Start camera
        </button>
      )}
      <div className="phone-viewfinder" hidden={!active}>
        <video ref={video} muted playsInline aria-label="Live camera preview" />
        <span className="phone-capture-guide" aria-hidden="true" />
      </div>
      {status === 'opening' && (
        <div className="phone-camera-actions">
          <p role="status">Opening camera…</p>
          <button type="button" className="phone-quiet-button" onClick={stop}>Cancel</button>
        </div>
      )}
      {status === 'live' && (
        <>
          <p className="phone-hint">Center one bottle barcode, then tap Capture.</p>
          <div className="phone-camera-actions">
            <button type="button" className="phone-start" onClick={() => void capture()}
              disabled={reading || busy}>
              {reading ? 'Reading barcode…' : 'Capture'}
            </button>
            <button type="button" className="phone-quiet-button" onClick={stop}>Stop camera</button>
          </div>
          {capabilities.torch && (
            <button type="button" className="phone-torch" aria-label="Toggle torch" aria-pressed={torch}
              onClick={() => void changeCamera({ torch: !torch }).then((changed) => {
                if (changed) setTorch(!torch);
              })}>
              {torch ? 'Torch on' : 'Toggle torch'}
            </button>
          )}
          {capabilities.zoom && (
            <label className="phone-zoom">
              <span>Zoom</span>
              <input type="range" aria-label="Zoom" value={zoom}
                min={capabilities.zoom.min} max={capabilities.zoom.max} step={capabilities.zoom.step || .1}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  void changeCamera({ zoom: value }).then((changed) => { if (changed) setZoom(value); });
                }} />
            </label>
          )}
          {dimHint && (
            <div className="phone-night">
              <span>Dim store?</span>
              <button type="button" className="phone-night-enable" onClick={async () => {
                if (capabilities.torch && await changeCamera({ torch: true })) setTorch(true);
                await changeCamera({ exposureCompensation: 2 });
                setDimHint(false);
              }}>Night mode</button>
            </div>
          )}
        </>
      )}
      {status === 'failed' && <p role="alert">Camera unavailable. Check camera access or type the barcode.</p>}
      {error && <p className="phone-error" role="alert">{error}</p>}
      {manual ? (
        <form className="phone-manual" onSubmit={(event) => {
          event.preventDefault();
          const barcode = validBarcode(manualCode);
          if (!barcode) {
            setError('Enter a valid barcode and try again.');
            return;
          }
          if (busy || reading) return;
          setManualCode('');
          submit(barcode);
        }}>
          <label htmlFor="phone-manual-barcode">Barcode</label>
          <input id="phone-manual-barcode" value={manualCode} inputMode="numeric" maxLength={128}
            autoComplete="off" onChange={(event) => { setManualCode(event.target.value); setError(''); }} />
          <button type="submit" className="phone-start phone-manual-check" disabled={busy || reading}>Check price</button>
        </form>
      ) : (
        <button type="button" className="phone-quiet-button" onClick={() => { setError(''); setManual(true); }}>
          Type barcode
        </button>
      )}
    </section>
  );
}
