// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useStaleSession } from './use-idle-timer';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useStaleSession', () => {
  it('fires once after the inactivity window and wipes the customer session', () => {
    vi.useFakeTimers();
    const cleared = vi.fn();
    const { result, rerender } = renderHook(
      ({ activity }: { activity: string }) => useStaleSession(activity, cleared),
      { initialProps: { activity: 'result:1' } }
    );
    vi.advanceTimersByTime(5 * 60_000 - 1000);
    rerender({ activity: 'idle:0' }); // customer keeps interacting — restarts
    vi.advanceTimersByTime(5 * 60_000 - 1000);
    expect(cleared).not.toHaveBeenCalled();
    rerender({ activity: 'idle:0' });
    vi.advanceTimersByTime(1000);
    expect(cleared).toHaveBeenCalledTimes(1);
    // one shot until the holder re-arms after content returns
    vi.advanceTimersByTime(5 * 60_000);
    rerender({ activity: 'idle:0' });
    vi.advanceTimersByTime(5 * 60_000);
    expect(cleared).toHaveBeenCalledTimes(1);
  });
  it('is harmless when the kiosk holds no content (store cleared = no-op)', () => {
    vi.useFakeTimers();
    const cleared = vi.fn();
    renderHook(() =>
      useStaleSession('', cleared, { enabled: false })
    );
    vi.advanceTimersByTime(10 * 60_000);
    expect(cleared).not.toHaveBeenCalled();
  });
});
