import { afterEach, describe, expect, it, vi } from 'vitest';
import { openPOSRealtime } from './pos-realtime';
const { io, disconnect } = vi.hoisted(() => ({ io: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('POS socket availability', () => {
  it('does not open a socket against a serverless backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: false }) }));
    const dispose = openPOSRealtime('https://backend.test', 'private-token', vi.fn());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await Promise.resolve();
    expect(io).not.toHaveBeenCalled();
    dispose();
  });
  it('opens a bounded socket only after availability is confirmed and cleans it up', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ available: true }) }));
    io.mockReturnValue({ disconnect });
    const onSocket = vi.fn();
    const dispose = openPOSRealtime('https://backend.test/', 'private-token', onSocket);
    await vi.waitFor(() => expect(onSocket).toHaveBeenCalled());
    expect(fetch).toHaveBeenCalledWith('https://backend.test/realtime-status', expect.objectContaining({ credentials: 'omit' }));
    expect(io).toHaveBeenCalledWith('https://backend.test/', expect.objectContaining({ auth: { token: 'private-token' }, reconnectionAttempts: 3 }));
    dispose();
    expect(disconnect).toHaveBeenCalledOnce();
  });
  it('never connects after the effect has been disposed during the probe', async () => {
    let resolve!: (v: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { resolve = r; })));
    const dispose = openPOSRealtime('https://backend.test', 'token', vi.fn());
    dispose();
    resolve({ ok: true, json: async () => ({ available: true }) });
    await new Promise(r => setTimeout(r, 0));
    expect(io).not.toHaveBeenCalled();
  });
  it('aborts a slow probe after five seconds and ignores a late success', async () => {
    vi.useFakeTimers();
    let resolve!: (v: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(r => { resolve = r; })));
    const dispose = openPOSRealtime('https://backend.test', 'token', vi.fn());
    const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(signal?.aborted).toBe(true);
    resolve({ ok: true, json: async () => ({ available: true }) });
    await vi.advanceTimersByTimeAsync(0);
    expect(io).not.toHaveBeenCalled();
    dispose();
  });
  it.each([false, 'legacy', 'failure'])('keeps REST fallback when the probe is %s', async mode => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => {
      if (mode === 'failure') throw new Error('offline');
      return { ok: mode !== false, json: async () => ({ status: 'OK' }) };
    }));
    const dispose = openPOSRealtime('https://backend.test', 'token', vi.fn());
    await new Promise(r => setTimeout(r, 0));
    expect(io).not.toHaveBeenCalled();
    dispose();
  });
});
