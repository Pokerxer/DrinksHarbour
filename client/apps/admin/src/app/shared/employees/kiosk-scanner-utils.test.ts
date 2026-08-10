import { describe, it, expect, vi } from 'vitest';
import {
  SCANNER_STATE,
  pickCameraId,
  stopScannerSafely,
  startScannerSession,
  type ScannerLike,
} from './kiosk-scanner-utils';

// ── A stand-in for html5-qrcode that keeps its exact failure modes ─────────
//
// Verified against html5-qrcode@2.3.8 (src/html5-qrcode.ts:546 and :1377):
//   • stop()  throws a STRING, SYNCHRONOUSLY, when the state is NOT_STARTED
//   • clear() throws a STRING when the state is anything BUT NOT_STARTED
// Both of those are what the real teardown walked into, so the fake has to
// keep them or the test proves nothing.

class FakeScanner implements ScannerLike {
  state: number = SCANNER_STATE.NOT_STARTED;
  stopped = 0;
  cleared = 0;
  onDecode?: (text: string) => void;
  /** Resolves the pending start(), letting a test hold the race open. */
  releaseStart?: () => void;

  constructor(
    private readonly opts: {
      startFails?: boolean;
      startPending?: boolean;
      stopRejects?: boolean;
    } = {}
  ) {}

  getState() {
    return this.state;
  }

  async start(
    _cameraId: string,
    _config: unknown,
    onDecode: (text: string) => void
  ) {
    this.onDecode = onDecode;
    if (this.opts.startPending) {
      await new Promise<void>((resolve) => {
        this.releaseStart = resolve;
      });
    }
    if (this.opts.startFails) throw new Error('Permission denied');
    this.state = SCANNER_STATE.SCANNING;
  }

  stop() {
    if (this.state === SCANNER_STATE.NOT_STARTED) {
      throw 'Cannot stop, scanner is not running or paused.';
    }
    if (this.opts.stopRejects) {
      return Promise.reject(new Error('track already ended'));
    }
    this.stopped += 1;
    this.state = SCANNER_STATE.NOT_STARTED;
    return Promise.resolve();
  }

  clear() {
    if (this.state !== SCANNER_STATE.NOT_STARTED) {
      throw 'Cannot clear while scan is ongoing, close it first.';
    }
    this.cleared += 1;
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

// ── Choosing a camera ─────────────────────────────────────────────────────

describe('picking which camera to scan with', () => {
  it('prefers the back camera on a tablet with two', () => {
    // A wall-mounted kiosk faces the room; the front camera faces the wall.
    expect(pickCameraId([{ id: 'front' }, { id: 'back' }])).toBe('back');
  });

  it('uses the only camera when there is just one', () => {
    expect(pickCameraId([{ id: 'only' }])).toBe('only');
  });

  it('reports no camera rather than picking a phantom one', () => {
    expect(pickCameraId([])).toBeNull();
  });
});

// ── Stopping without taking the page down ─────────────────────────────────

describe('stopping a scanner', () => {
  it('does not throw when the scanner was never started', async () => {
    // THE CRASH. html5-qrcode's stop() throws synchronously here, and a
    // synchronous throw walks straight past .catch()/.finally() and out of
    // the effect cleanup, where React turns it into the error boundary.
    const scanner = new FakeScanner();
    await expect(stopScannerSafely(scanner)).resolves.toBeUndefined();
    expect(scanner.stopped).toBe(0);
  });

  it('still releases the camera when the scanner is running', async () => {
    const scanner = new FakeScanner();
    scanner.state = SCANNER_STATE.SCANNING;
    await stopScannerSafely(scanner);
    expect(scanner.stopped).toBe(1);
    expect(scanner.state).toBe(SCANNER_STATE.NOT_STARTED);
  });

  it('stops a paused scanner too', async () => {
    const scanner = new FakeScanner();
    scanner.state = SCANNER_STATE.PAUSED;
    await stopScannerSafely(scanner);
    expect(scanner.stopped).toBe(1);
  });

  it('swallows a rejected stop, and the failing clear that follows it', async () => {
    // A camera track that has already ended rejects. The library leaves the
    // state at SCANNING when that happens (the stop transaction is never
    // executed), so the clear() that follows throws in turn. Both have to be
    // absorbed — this is the one path where BOTH of the library's failure
    // modes fire on the same teardown.
    const scanner = new FakeScanner({ stopRejects: true });
    scanner.state = SCANNER_STATE.SCANNING;
    await expect(stopScannerSafely(scanner)).resolves.toBeUndefined();
    expect(scanner.cleared).toBe(0);
  });

  it('clears the viewfinder after a successful stop', async () => {
    const scanner = new FakeScanner();
    scanner.state = SCANNER_STATE.SCANNING;
    await stopScannerSafely(scanner);
    expect(scanner.cleared).toBe(1);
  });

  it('does not throw when there is no scanner at all', async () => {
    await expect(stopScannerSafely(null)).resolves.toBeUndefined();
  });
});

// ── The mount/unmount lifecycle ───────────────────────────────────────────

describe('the scanner session', () => {
  const deps = (scanner: ScannerLike, cameras = [{ id: 'back' }]) => ({
    createScanner: async () => scanner,
    listCameras: async () => cameras,
    onDecode: vi.fn(),
    onUnavailable: vi.fn(),
    isBusy: () => false,
  });

  it('starts the camera and forwards a decoded badge', async () => {
    const scanner = new FakeScanner();
    const d = deps(scanner);
    const session = startScannerSession(d);
    await session.ready;

    scanner.onDecode?.('EMP-001');
    expect(d.onDecode).toHaveBeenCalledWith('EMP-001');
  });

  it('releases the camera when a start still in flight is disposed', async () => {
    // StrictMode mounts, unmounts and remounts. The unmount lands while
    // start() is still awaiting, so a session that gave up at that point
    // would leave the camera light on for the rest of the page's life.
    const scanner = new FakeScanner({ startPending: true });
    const session = startScannerSession(deps(scanner));
    await flush();

    const disposed = session.dispose();
    scanner.releaseStart?.(); // the camera comes up AFTER we asked to stop
    await disposed;

    expect(scanner.stopped).toBe(1);
    expect(scanner.getState()).toBe(SCANNER_STATE.NOT_STARTED);
  });

  it('ignores a decode that lands after disposal', async () => {
    const scanner = new FakeScanner();
    const d = deps(scanner);
    const session = startScannerSession(d);
    await session.ready;
    await session.dispose();

    scanner.onDecode?.('EMP-001');
    expect(d.onDecode).not.toHaveBeenCalled();
  });

  it('ignores a decode while a punch is still in flight', async () => {
    // html5-qrcode fires the success callback once per decoded frame at
    // fps 10 — a badge held to the lens must not queue ten punches.
    const scanner = new FakeScanner();
    const d = { ...deps(scanner), isBusy: () => true };
    const session = startScannerSession(d);
    await session.ready;

    scanner.onDecode?.('EMP-001');
    expect(d.onDecode).not.toHaveBeenCalled();
  });

  it('falls back to keyboard entry when the device has no camera', async () => {
    const scanner = new FakeScanner();
    const d = deps(scanner, []);
    const session = startScannerSession(d);
    await session.ready;

    expect(d.onUnavailable).toHaveBeenCalled();
  });

  it('falls back to keyboard entry when camera permission is refused', async () => {
    const scanner = new FakeScanner({ startFails: true });
    const d = deps(scanner);
    const session = startScannerSession(d);
    await session.ready;

    expect(d.onUnavailable).toHaveBeenCalled();
  });

  it('disposes cleanly after a refused permission', async () => {
    // The scanner exists but never reached SCANNING — this is the exact
    // state whose stop() threw and took the page down.
    const scanner = new FakeScanner({ startFails: true });
    const session = startScannerSession(deps(scanner));
    await session.ready;

    await expect(session.dispose()).resolves.toBeUndefined();
  });

  it('does not report the camera unavailable after disposal', async () => {
    // Switching to keyboard entry unmounts the camera. A late failure from
    // the abandoned start would otherwise flip the mode back underneath
    // whoever is already typing.
    const scanner = new FakeScanner({ startPending: true, startFails: true });
    const d = deps(scanner);
    const session = startScannerSession(d);
    await flush();

    const disposed = session.dispose();
    scanner.releaseStart?.();
    await disposed;

    expect(d.onUnavailable).not.toHaveBeenCalled();
  });

  it('survives disposal before the scanner is even constructed', async () => {
    let release: (s: ScannerLike) => void = () => {};
    const session = startScannerSession({
      createScanner: () => new Promise<ScannerLike>((r) => (release = r)),
      listCameras: async () => [{ id: 'back' }],
      onDecode: vi.fn(),
      onUnavailable: vi.fn(),
      isBusy: () => false,
    });

    const disposed = session.dispose();
    const scanner = new FakeScanner();
    release(scanner);
    await disposed;

    expect(scanner.stopped).toBe(0);
    expect(scanner.getState()).toBe(SCANNER_STATE.NOT_STARTED);
  });

  it('is safe to dispose twice', async () => {
    // React can call a cleanup more than once across a fast remount.
    const scanner = new FakeScanner();
    const session = startScannerSession(deps(scanner));
    await session.ready;

    await session.dispose();
    await expect(session.dispose()).resolves.toBeUndefined();
    expect(scanner.stopped).toBe(1);
  });
});

// ── Pinning the fake to the real library ──────────────────────────────────
//
// Everything above trusts FakeScanner to fail the way html5-qrcode fails.
// These run against the real module so that a version bump which changes the
// teardown contract breaks here rather than on a wall-mounted kiosk.

describe('html5-qrcode itself', () => {
  /**
   * The smallest browser stub the constructor will accept: it looks up its
   * container element, and sniffs `window` for a native BarcodeDetector.
   */
  async function realScanner() {
    const el = { style: {}, clientWidth: 320, innerHTML: '' };
    const g = globalThis as Record<string, unknown>;
    g.document = {
      getElementById: () => el,
      createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
    };
    g.window = g;
    const mod = await import('html5-qrcode');
    return new mod.Html5Qrcode('kiosk-qr-reader', { verbose: false });
  }

  it('throws SYNCHRONOUSLY from stop() when it never started', async () => {
    // The reason the crash existed: a synchronous throw walks straight past
    // .catch() and .finally(), out of the effect cleanup, into the boundary.
    const scanner = await realScanner();
    expect(scanner.getState()).toBe(SCANNER_STATE.NOT_STARTED);
    expect(() => scanner.stop()).toThrow(
      /Cannot stop, scanner is not running or paused/
    );
  });

  it('is torn down by stopScannerSafely without throwing', async () => {
    const scanner = await realScanner();
    await expect(
      stopScannerSafely(scanner as unknown as ScannerLike)
    ).resolves.toBeUndefined();
  });
});
