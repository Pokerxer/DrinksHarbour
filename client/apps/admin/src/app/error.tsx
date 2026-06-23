'use client';

export const dynamic = 'force-static';
export const revalidate = 0;

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
        <div className="mt-6">
          <button
            onClick={() => reset()}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}