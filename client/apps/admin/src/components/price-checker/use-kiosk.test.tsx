// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useKiosk } from './use-kiosk';
import { checkPrice, KioskError, openKiosk } from './api';
import type { KioskConfig, ScanResult } from './types';

vi.mock('./api', () => ({
  checkPrice: vi.fn(),
  openKiosk: vi.fn(),
  KioskError: class KioskError extends Error {
    constructor(public status: number) {
      super('Kiosk request failed');
    }
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  vi.useRealTimers();
});

const config: KioskConfig = {
  slug: 'counter',
  currency: 'NGN',
  settings: { resetSeconds: 5 } as KioskConfig['settings'],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const found = (name: string): ScanResult => ({
  config,
  found: true,
  status: 'FOUND',
  product: {
    name,
    price: 100,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: 'Tax included',
  },
});

function hardwareScan(code: string) {
  for (const key of [...code, 'Enter'])
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
}

it('waits for session initialization before accepting hardware or manual scans', async () => {
  const opening = deferred<KioskConfig>();
  vi.mocked(openKiosk).mockReturnValue(opening.promise);
  const { result } = renderHook(() => useKiosk('counter'));
  await act(async () => {
    hardwareScan('00456');
    await result.current.scan('00123');
  });
  expect(checkPrice).not.toHaveBeenCalled();
  expect(vi.mocked(openKiosk).mock.calls[0][1].aborted).toBe(false);
  await act(async () => {
    opening.resolve(config);
  });
  expect(result.current.screen).toBe('idle');
});

it('does not send hardware scans after the kiosk has been closed', async () => {
  vi.mocked(openKiosk).mockRejectedValue(new KioskError(403));
  const { result } = renderHook(() => useKiosk('counter'));
  await waitFor(() => expect(result.current.screen).toBe('closed'));
  await act(async () => {
    hardwareScan('00456');
    await result.current.scan('00123');
  });
  expect(checkPrice).not.toHaveBeenCalled();
  expect(result.current.screen).toBe('closed');
});

it('accepts hardware scans from idle and result screens, then recovers through retry', async () => {
  vi.mocked(openKiosk).mockResolvedValue(config);
  vi.mocked(checkPrice)
    .mockResolvedValueOnce(found('First'))
    .mockResolvedValueOnce(found('Second'))
    .mockRejectedValueOnce(new KioskError(503))
    .mockResolvedValueOnce(found('Recovered'));
  const { result } = renderHook(() => useKiosk('counter'));
  await waitFor(() => expect(result.current.screen).toBe('idle'));
  await act(async () => {
    hardwareScan('00123');
  });
  expect(result.current.product?.name).toBe('First');
  await act(async () => {
    hardwareScan('00456');
  });
  expect(result.current.product?.name).toBe('Second');
  await act(async () => {
    hardwareScan('00789');
  });
  expect(result.current.screen).toBe('offline');
  await act(async () => {
    await result.current.initialize();
  });
  expect(result.current.screen).toBe('idle');
  await act(async () => {
    hardwareScan('00888');
  });
  expect(result.current.product?.name).toBe('Recovered');
});

it('aborts an older scan and ignores its late response', async () => {
  vi.mocked(openKiosk).mockResolvedValue(config);
  const first = deferred<ScanResult>();
  const second = deferred<ScanResult>();
  vi.mocked(checkPrice)
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useKiosk('counter'));
  await waitFor(() => expect(result.current.screen).toBe('idle'));
  act(() => {
    void result.current.scan('00123');
  });
  act(() => {
    void result.current.scan('00456');
  });
  expect(vi.mocked(checkPrice).mock.calls[0][3].aborted).toBe(true);
  await act(async () => {
    second.resolve(found('New product'));
  });
  await act(async () => {
    first.resolve(found('Old product'));
  });
  expect(result.current.product?.name).toBe('New product');
});

it('preserves an incoming barcode while a previous price result arrives', async () => {
  vi.mocked(openKiosk).mockResolvedValue(config);
  const first = deferred<ScanResult>();
  vi.mocked(checkPrice)
    .mockReturnValueOnce(first.promise)
    .mockResolvedValueOnce(found('Second'));
  const { result } = renderHook(() => useKiosk('counter'));
  await waitFor(() => expect(result.current.screen).toBe('idle'));
  act(() => {
    hardwareScan('00123');
  });
  act(() => {
    for (const key of '00')
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true })
      );
  });
  await act(async () => {
    first.resolve(found('First'));
  });
  await act(async () => {
    hardwareScan('456');
  });
  expect(result.current.product?.name).toBe('Second');
  expect(vi.mocked(checkPrice).mock.calls[1][1]).toBe('00456');
});

it('starts a fresh countdown for a new result and does not reuse the old reset deadline', async () => {
  vi.useFakeTimers();
  vi.mocked(openKiosk).mockResolvedValue(config);
  vi.mocked(checkPrice)
    .mockResolvedValueOnce(found('First'))
    .mockResolvedValueOnce(found('Second'));
  const { result } = renderHook(() => useKiosk('counter'));
  await act(async () => {});
  await act(async () => {
    await result.current.scan('00123');
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  await act(async () => {
    await result.current.scan('00456');
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(result.current.product?.name).toBe('Second');
  expect(result.current.remaining).toBe(4);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4000);
  });
  expect(result.current.screen).toBe('idle');
});

it('enters the comparison screen from a result and auto-resets to idle', async () => {
  vi.useFakeTimers();
  vi.mocked(openKiosk).mockResolvedValue(config);
  vi.mocked(checkPrice).mockResolvedValueOnce(found('First'));
  const { result } = renderHook(() => useKiosk('counter'));
  await act(async () => {});
  await act(async () => {
    await result.current.scan('00123');
  });
  expect(result.current.screen).toBe('result');
  act(() => {
    result.current.openCompare();
  });
  expect(result.current.screen).toBe('compare');
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5500);
  });
  expect(result.current.screen).toBe('idle');
});

it('openCompare stays inert before the session opens and during a lookup', async () => {
  vi.mocked(openKiosk).mockReturnValue(new Promise<KioskConfig>(() => {}));
  const { result } = renderHook(() => useKiosk('counter'));
  act(() => {
    result.current.openCompare();
  });
  expect(result.current.screen).toBe('initializing');
});

it('openCompare is ignored while the welcome screen loads offline', async () => {
  vi.mocked(openKiosk).mockRejectedValue(new KioskError(503));
  const { result } = renderHook(() => useKiosk('counter'));
  await waitFor(() => expect(result.current.screen).toBe('offline'));
  act(() => {
    result.current.openCompare();
  });
  expect(result.current.screen).toBe('offline');
});
