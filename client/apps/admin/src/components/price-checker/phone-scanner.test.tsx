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
    };
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
