'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PiArrowClockwiseBold } from 'react-icons/pi';
import { Button } from 'rizzui/button';

/** Client-side "try again" that re-runs the server component's data fetch. */
export default function RetryButton({ label = 'Try again' }: { label?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      className="h-9 gap-1.5"
    >
      <PiArrowClockwiseBold
        className={`h-3.5 w-3.5 ${isPending ? 'animate-spin motion-reduce:animate-none' : ''}`}
      />
      {isPending ? 'Retrying…' : label}
    </Button>
  );
}
