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
    /** Push a scanned code through the registered decoder during tests. */
    feed: (code: string) => decode?.(code),
    instance: () => ({ start: undefined, stop: undefined, clear: undefined }),
  };
});
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: function MockReader() {
    return {
      start: reader.start,
      stop: reader.stop,
      clear: reader.clear,
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
