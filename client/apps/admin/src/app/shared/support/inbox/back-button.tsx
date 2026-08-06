// @ts-nocheck
'use client';

import { useRouter } from 'next/navigation';
import { PiArrowLeft } from 'react-icons/pi';
import { Button } from 'rizzui';

export default function BackButton() {
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => router.back()}
      aria-label="Back to inbox"
      className="flex items-center gap-2"
    >
      <PiArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
