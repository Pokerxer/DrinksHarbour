'use client';
import { useEffect, useRef, useState } from 'react';
import type { OwnExamination } from '@/services/examination.service';
export default function useExamClock(exam: OwnExamination | null) {
  const anchor = useRef({ server: 0, local: 0, end: 0 });
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!exam?.expiresAt || exam.submittedAt || exam.status !== 'collecting') {
      setRemaining(null);
      return;
    }
    anchor.current = {
      server: Date.parse(exam.serverNow ?? new Date().toISOString()),
      local: performance.now(),
      end: Date.parse(exam.expiresAt),
    };
    const tick = () => {
      const a = anchor.current;
      setRemaining(
        Math.max(0, a.end - a.server - (performance.now() - a.local))
      );
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [exam?.expiresAt, exam?.serverNow, exam?.submittedAt, exam?.status]);
  return remaining;
}
export function clockText(remaining: number) {
  const seconds = Math.ceil(remaining / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
