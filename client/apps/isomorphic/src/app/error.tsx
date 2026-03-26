'use client';

import Link from 'next/link';
import { Button } from 'rizzui';
import { PiHouseLineBold } from 'react-icons/pi';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-2 text-gray-600">
          We're sorry, but something went wrong. Please try again.
        </p>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button
            onClick={() => reset()}
            className="h-12 px-6"
          >
            Try again
          </Button>
          <Link href="/">
            <Button
              variant="outline"
              className="h-12 px-6"
            >
              <PiHouseLineBold className="mr-2" />
              Go home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}