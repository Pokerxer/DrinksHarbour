'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PiArrowClockwiseBold } from 'react-icons/pi';
import { Button } from 'rizzui/button';

/**
 * Client-side "try again" that re-runs the server component's data fetch.
 * Response guard: clicks while a refresh is already in flight are ignored —
 * `usePending`-style transitions make `isPending` true for the entire
 * server re-render, so each click resolves against exactly one response
 * (no lost/duplicated refresh). Disabled + aria-busy while in flight, with a
 * visible focus ring for keyboard users.
 */
export default function RetryButton({
  label = 'Try again',
}: {
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function retry() {
    if (isPending) return; // response guard: one refresh at a time
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      onClick={retry}
      disabled={isPending}
      aria-busy={isPending}
      className="h-9 gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <PiArrowClockwiseBold
        className={`h-3.5 w-3.5 ${isPending ? 'animate-spin motion-reduce:animate-none' : ''}`}
      />
      {isPending ? 'Retrying…' : label}
    </Button>
  );
}
