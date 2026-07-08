"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ProductError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ProductPage] error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Something went wrong</h1>
        <p className="text-gray-600 mb-8">
          We couldn&apos;t load this product page. Please try again or browse the shop.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-lg font-semibold hover:from-red-800 hover:to-red-950 transition-all shadow-md"
          >
            Try Again
          </button>
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-200 text-red-800 rounded-lg font-semibold hover:border-red-700 hover:bg-red-50 transition-colors"
          >
            Browse the Shop
          </Link>
        </div>
      </div>
    </div>
  );
}
