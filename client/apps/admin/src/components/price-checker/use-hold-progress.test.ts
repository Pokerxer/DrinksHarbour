// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useHoldProgress } from './use-hold-progress';

function rafClock() {
  let time = 0;
  let queue: Array<(time: number) => void> = [];
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    queue.push(cb);
    return queue.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
  return {
    advance(ms: number) {
      const target = time + ms;
      while (time < target) {
        time += 16;
        const current = queue;
        queue = [];
        for (const cb of current) cb(time);
        if (!current.length) {
          time = target;
          break;
        }
      }
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useHoldProgress', () => {
  it('reaches 1 after ~1.5s of holding', async () => {
    const clock = rafClock();
    const { result } = renderHook(() => useHoldProgress(1500));
    act(() => result.current.start());
    act(() => clock.advance(750));
    expect(result.current.progress).toBeGreaterThan(0.4);
    expect(result.current.progress).toBeLessThan(0.7);
    await act(async () => clock.advance(800));
    expect(result.current.progress).toBe(1);
  });
  it('cancels cleanly on early release', async () => {
    const clock = rafClock();
    const { result } = renderHook(() => useHoldProgress(1500));
    act(() => result.current.start());
    act(() => clock.advance(400));
    await act(async () => {});
    act(() => result.current.cancel());
    await act(async () => clock.advance(900));
    expect(result.current.progress).toBe(0);
  });
  it('fires onComplete exactly once at the end of the hold', async () => {
    const clock = rafClock();
    const onComplete = vi.fn();
    const { result } = renderHook(() => useHoldProgress(1500, onComplete));
    act(() => result.current.start());
    await act(async () => clock.advance(1500));
    await act(async () => clock.advance(200));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
