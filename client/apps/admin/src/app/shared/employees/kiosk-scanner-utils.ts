// The camera-scanner lifecycle for the attendance kiosk, kept out of the
// component so it can be tested — vitest runs with `environment: 'node'`, so
// nothing that only exists inside a React render is reachable from a test.
//
// WHY THIS FILE EXISTS AT ALL
// ---------------------------
// html5-qrcode's teardown is a minefield of synchronous throws, and the kiosk
// is a wall-mounted screen nobody is watching — a crash there is a shop that
// cannot clock anybody in until someone notices and reloads it. Verified
// against html5-qrcode@2.3.8:
//
//   • `stop()` throws a STRING, SYNCHRONOUSLY (src/html5-qrcode.ts:546) when
//     the scanner is not SCANNING or PAUSED. A synchronous throw walks past
//     `.catch()` and `.finally()`, out of the React effect cleanup, and into
//     the error boundary. That is the "Something went wrong" the kiosk showed.
//   • `clear()` throws (src/html5-qrcode.ts:1377) in the opposite case — when
//     a scan IS ongoing.
//
// So: never call either without checking `getState()` first, and never let
// either escape. Teardown that can fail is teardown that takes the page down.

/**
 * Mirrors html5-qrcode's `Html5QrcodeScannerState`. Re-declared rather than
 * imported so this module stays free of the library (which touches `document`
 * at import time) and can be unit-tested.
 */
export const SCANNER_STATE = {
  UNKNOWN: 0,
  NOT_STARTED: 1,
  SCANNING: 2,
  PAUSED: 3,
} as const;

/** The slice of `Html5Qrcode` this module actually uses. */
export interface ScannerLike {
  getState(): number;
  // Resolves to `null` in html5-qrcode, not undefined — only ever awaited.
  start(
    cameraId: string,
    config: unknown,
    onDecode: (text: string) => void,
    onDecodeError: (message: string) => void
  ): Promise<unknown>;
  stop(): Promise<void>;
  clear(): void;
}

export interface CameraLike {
  id: string;
}

/**
 * Which camera a kiosk should scan with.
 *
 * A wall-mounted tablet faces the room with its back camera and the wall with
 * its front one, and the back camera is consistently last in the enumeration.
 * Returns null for a device with no camera at all, which is a fallback to
 * keyboard entry rather than an error.
 */
export function pickCameraId(cameras: readonly CameraLike[]): string | null {
  if (cameras.length === 0) return null;
  return cameras.length > 1 ? cameras[cameras.length - 1].id : cameras[0].id;
}

/**
 * Shuts a scanner down without ever throwing.
 *
 * Guards on the scanner's own state rather than on the handle being non-null:
 * a constructed-but-never-started scanner is a live object whose `stop()`
 * throws. Both calls are wrapped because a teardown that can fail is worse
 * than a camera that stays on.
 */
export async function stopScannerSafely(
  scanner: ScannerLike | null | undefined
): Promise<void> {
  if (!scanner) return;

  try {
    if (scanner.getState() !== SCANNER_STATE.NOT_STARTED) {
      await scanner.stop();
    }
  } catch {
    // A track that has already ended rejects; a scanner that never started
    // throws. Neither is worth a crash — the view is going away regardless.
  }

  try {
    scanner.clear();
  } catch {
    // Only throws while a scan is ongoing, i.e. the stop above did not take.
    // The video element goes with the unmounting DOM node anyway.
  }
}

export interface ScannerSessionDeps {
  /** Constructs the scanner. Mirrors the dynamic `import()` + `new Html5Qrcode`. */
  createScanner: () => Promise<ScannerLike>;
  /** Enumerates cameras. Mirrors `Html5Qrcode.getCameras()`. */
  listCameras: () => Promise<readonly CameraLike[]>;
  /** A badge was decoded. */
  onDecode: (text: string) => void;
  /** No camera, or the browser refused it — the caller should offer the keyboard. */
  onUnavailable: () => void;
  /** True while a punch is in flight, so repeat frames are dropped. */
  isBusy: () => boolean;
  /** Passed straight to `start()`. */
  config?: unknown;
}

export interface ScannerSession {
  /** Resolves once the session has settled, one way or the other. For tests. */
  ready: Promise<void>;
  /** Tears the session down. Never rejects; safe to call more than once. */
  dispose: () => Promise<void>;
}

/**
 * Brings the camera up and hands back a teardown.
 *
 * The awkward part is that `start()` is slow and a kiosk view can be unmounted
 * while it is still in flight — React StrictMode does exactly that on every
 * dev mount. Abandoning the start there leaves a camera streaming with no way
 * to reach it, so disposal waits for the in-flight start to settle and *then*
 * stops it. `disposed` also gates the decode and failure callbacks, so a
 * camera that comes up after the view is gone cannot punch anybody in or flip
 * the mode out from under whoever is already typing.
 */
export function startScannerSession(deps: ScannerSessionDeps): ScannerSession {
  let disposed = false;
  let scanner: ScannerLike | null = null;

  const ready = (async () => {
    try {
      const instance = await deps.createScanner();
      // Assigned even when already disposed: it is the only handle to a
      // scanner that may yet need stopping.
      scanner = instance;
      if (disposed) return;

      const cameras = await deps.listCameras();
      if (disposed) return;

      const cameraId = pickCameraId(cameras);
      if (cameraId === null) {
        deps.onUnavailable();
        return;
      }

      await instance.start(
        cameraId,
        deps.config,
        (text: string) => {
          if (!disposed && !deps.isBusy()) deps.onDecode(text);
        },
        () => {} // per-frame decode misses are the normal case, not an error
      );
    } catch {
      // No camera, permission refused, or the element went away mid-start.
      if (!disposed) deps.onUnavailable();
    }
  })();

  return {
    ready,
    dispose: async () => {
      disposed = true;
      // Let the start finish before stopping it, or we would stop a scanner
      // that has not come up yet and leave the real one running.
      await ready;
      await stopScannerSafely(scanner);
      scanner = null;
    },
  };
}
