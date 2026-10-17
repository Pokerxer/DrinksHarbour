'use client';
import { useEffect, useRef, useState } from 'react';
export type ReviewNavigation = 'close' | 'reload';
export function useReviewNavigation({
  recordKey,
  dirty,
  busy,
  onClose,
  onReload,
  onFocusReview,
}: {
  recordKey: string;
  dirty: boolean;
  busy: boolean;
  onClose: () => void;
  onReload: () => void;
  onFocusReview: () => void;
}) {
  const [intent, setIntent] = useState<{
    key: string;
    action: ReviewNavigation;
  } | null>(null);
  const origin = useRef<HTMLElement | null>(null);
  const pending = intent?.key === recordKey ? intent.action : null;
  useEffect(() => {
    if (!dirty && !busy) return;
    const protect = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty, busy]);
  const run = (action: ReviewNavigation) =>
    action === 'close' ? onClose() : onReload();
  return {
    pending,
    request: (action: ReviewNavigation) => {
      if (busy) return;
      if (!dirty) return run(action);
      origin.current = document.activeElement as HTMLElement | null;
      setIntent({ key: recordKey, action });
    },
    cancel: () => {
      setIntent(null);
      if (origin.current?.isConnected) origin.current.focus();
      else onFocusReview();
    },
    proceed: () => {
      if (!pending || busy) return;
      setIntent(null);
      run(pending);
    },
  };
}
