// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useCountUp } from './use-count-up';

const frames: number[] = [];

function stubRaf() {
  frames.length = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    const time = (frames.at(-1) ?? -16) + 100;
    frames.push(time);
    cb(time); // synchronous stepping: ~6 frames ≈ 600ms
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useCountUp', () => {
  it('counts up over ~600ms and lands exactly on the target', () => {
    stubRaf();
    const { result } = renderHook(() => useCountUp(9000, false));
    for (let i = 0; i < 7; i++) act(() => {});
    expect(result.current).toBe(9000);
  });
  it('shows the final price immediately under reduced motion', () => {
    const { result } = renderHook(() => useCountUp(9000, true));
    expect(result.current).toBe(9000);
  });
  it('falls back to the final price when rAF is unavailable', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const { result } = renderHook(() => useCountUp(9000, false));
    expect(result.current).toBe(9000);
  });
  it('restarts cleanly when the target changes', () => {
    stubRaf();
    const { result, rerender } = renderHook(
      ({ target }: { target: number }) => useCountUp(target, false),
      { initialProps: { target: 9000 } }
    );
    for (let i = 0; i < 7; i++) act(() => {});
    expect(result.current).toBe(9000);
    rerender({ target: 12000 });
    for (let i = 0; i < 7; i++) act(() => {});
    expect(result.current).toBe(12000);
  });
});
