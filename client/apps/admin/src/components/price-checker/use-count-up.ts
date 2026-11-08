'use client';
import { useEffect, useState } from 'react';

const DURATION_MS = 600;
const easeOut = (progress: number) => 1 - Math.pow(1 - progress, 3);

function rafAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function';
}

/**
 * Price count-up for the kiosk result screen. Under reduced motion — or when
 * rAF is missing — the price renders instantly, never animated.
 */
export function useCountUp(target: number, reducedMotion: boolean): number {
  const [value, setValue] = useState(() => {
    const reduced = reducedMotion || !rafAvailable();
    return reduced ? target : 0;
  });
  useEffect(() => {
    if (reducedMotion || !rafAvailable()) {
      setValue(target);
      return;
    }
    let start = -1;
    let frame = 0;
    const tick = (timestamp: number) => {
      if (start < 0) start = timestamp;
      const progress = Math.min(1, (timestamp - start) / DURATION_MS);
      setValue(target * easeOut(progress));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, reducedMotion]);
  return value;
}
