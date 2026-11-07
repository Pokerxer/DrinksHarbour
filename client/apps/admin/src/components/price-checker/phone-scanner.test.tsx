// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PhoneScanner } from './phone-scanner';

const reader = vi.hoisted(() => {
  let decode: ((code: string) => void) | null = null;
  return {
    start: vi.fn(async (_camera: unknown, _opts: unknown, onDecode: (code: string) => void) => {
      decode = onDecode;
    }),
    stop: vi.fn(async () => {}),
    clear: vi.fn(),
    applyVideoConstraints: undefined as undefined | ((constraints: unknown) => Promise<void>),
    getRunningTrackCapabilities: undefined as undefined | (() => { zoom?: { min: number; max: number } }),
    /** Push a scanned code through the registered decoder during tests. */
    feed: (code: string) => decode?.(code),
  };
});
// Per-test torch capability switch — the hook reads applyVideoConstraints
// from the shared hoisted reader mock via torchSupport.apply.
const torchSupport = {
  get apply() {
    return reader.applyVideoConstraints;
  },
  set apply(value: ((constraints: unknown) => Promise<void>) | undefined) {
    reader.applyVideoConstraints = value;
  },
};
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: function MockReader() {
    return {
      start: reader.start,
      stop: reader.stop,
      clear: reader.clear,
      applyVideoConstraints: reader.applyVideoConstraints,
      getRunningTrackCapabilities: reader.getRunningTrackCapabilities,
    };
  },
  Html5QrcodeSupportedFormats: {
    EAN_13: 1,
    EAN_8: 2,
    UPC_A: 3,
    UPC_E: 4,
    CODE_128: 5,
    CODE_39: 6,
    ITF_14: 7,
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('starts the camera once, forwards unique codes and ignores rapid repeats', async () => {
  const onScan = vi.fn();
  render(<PhoneScanner slug="counter" session="pair-0000000001" onScan={onScan} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  await waitFor(() => expect(reader.start).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  expect(reader.start).toHaveBeenCalledTimes(1);
  reader.feed('490187700713');
  reader.feed('490187700713');
  expect(onScan).toHaveBeenCalledTimes(1);
  reader.feed('490187700714');
  reader.feed('12');
  expect(onScan).toHaveBeenCalledTimes(2);
  expect(onScan).toHaveBeenNthCalledWith(1, '490187700713');
  expect(onScan).toHaveBeenNthCalledWith(2, '490187700714');
});

it('toggles the torch only when the reader supports it', async () => {
  const apply = vi.fn(async () => {});
  // extend MockReader with torch support before rendering:
  torchSupport.apply = apply;
  render(<PhoneScanner slug="counter" session="pair-0000000001" onScan={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  const torch = await screen.findByRole('button', { name: 'Toggle torch' });
  fireEvent.click(torch);
  await waitFor(() =>
    expect(apply).toHaveBeenCalledWith({ advanced: [{ torch: true }] })
  );
});

it('offers no torch button when the reader lacks the capability', async () => {
  torchSupport.apply = vi.fn(async () => {
    throw new Error('torch unsupported');
  });
  render(<PhoneScanner slug="counter" session="pair-0000000001" onScan={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Toggle torch' })).toBeNull()
  );
});

it('tunes the decoder for bottle symbologies and a wide horizontal band', async () => {
  render(<PhoneScanner slug="counter" session="pair-0000000001" onScan={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  await waitFor(() => expect(reader.start).toHaveBeenCalledTimes(1));
  const [, options] = reader.start.mock.calls[0] as unknown as [
    unknown,
    { fps: number; qrbox: { height: number }; experimentalFeatures: Record<string, boolean> },
  ];
  expect(options.fps).toBe(15);
  expect(options.qrbox).toMatchObject({ height: 140 });
  expect(options.experimentalFeatures).toEqual({ useBarCodeDetectorIfSupported: true });
});

it('offers a zoom slider only when the running track supports it', async () => {
  torchSupport.apply = vi.fn(async () => {});
  reader.getRunningTrackCapabilities = vi.fn(() => ({ zoom: { min: 1, max: 3 } }));
  render(<PhoneScanner slug="counter" session="pair-0000000001" onScan={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Start camera' }));
  const zoom = await screen.findByRole('slider', { name: 'Zoom' });
  fireEvent.change(zoom, { target: { value: '2.5' } });
  await waitFor(() =>
    expect(reader.applyVideoConstraints).toHaveBeenCalledWith({
      advanced: [{ zoom: 2.5 }],
    })
  );
});

it('accepts a manually typed barcode as a fallback', async () => {
  const onScan = vi.fn();
  render(<PhoneScanner slug="counter" session="pair-0000000001" onScan={onScan} />);
  fireEvent.click(screen.getByRole('button', { name: 'Type barcode' }));
  const input = screen.getByLabelText('Barcode');
  fireEvent.change(input, { target: { value: '490187700713' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check price' }));
  expect(onScan).toHaveBeenCalledWith('490187700713');
  fireEvent.change(input, { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Check price' }));
  expect(onScan).toHaveBeenCalledTimes(1);
});
