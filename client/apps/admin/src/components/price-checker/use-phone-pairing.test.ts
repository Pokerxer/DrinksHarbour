// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePhonePairing } from './use-phone-pairing';

const sockets = vi.hoisted(() => ({
  created: [] as unknown[],
}));
vi.mock('socket.io-client', () => ({
  io: () => {
    const socket = {
      emit: vi.fn(),
      on: vi.fn(),
      disconnect: vi.fn(),
    };
    sockets.created.push(socket);
    return socket;
  },
}));

beforeEach(() => {
  sockets.created.length = 0;
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('probes realtime availability, connects and joins the pairing room', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ available: true }), { status: 200 })
      )
    )
  );
  const onScan = vi.fn();
  const { result, unmount } = renderHook(() =>
    usePhonePairing('https://api.example', 'pair-1234567890', onScan)
  );
  await waitFor(() => expect(sockets.created).toHaveLength(1));
  const socket = sockets.created[0] as unknown as {
    emit: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  };
  expect(socket.on).toHaveBeenCalledWith('connect', expect.any(Function));
  expect(socket.on).toHaveBeenCalledWith('kiosk:scan', expect.any(Function));
  expect(result.current.connected).toBe(false);
  const connectHandler = socket.on.mock.calls.find(
    ([event]) => event === 'connect'
  )![1];
  await act(async () => {
    connectHandler();
  });
  expect(result.current.connected).toBe(true);
  expect(socket.emit).toHaveBeenCalledWith('pkiosk:join', 'pair-1234567890');
  const scanHandler = socket.on.mock.calls.find(
    ([event]) => event === 'kiosk:scan'
  )![1];
  scanHandler({
    found: true,
    product: {
      name: 'Bottle',
      price: 5,
      currency: 'NGN',
      alcoholic: false,
      taxLabel: '',
    },
  });
  expect(onScan).toHaveBeenCalledWith(expect.objectContaining({ name: 'Bottle' }));
  scanHandler({ found: false });
  expect(onScan).toHaveBeenCalledTimes(1);
  unmount();
  expect(socket.disconnect).toHaveBeenCalled();
});

it('stays unpaired when the realtime probe fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('{}', { status: 503 })))
  );
  const { result } = renderHook(() =>
    usePhonePairing('https://api.example', 'pair-1234567890', vi.fn())
  );
  await waitFor(() => expect(result.current.connected).toBe(false));
  expect(sockets.created).toHaveLength(0);
});
