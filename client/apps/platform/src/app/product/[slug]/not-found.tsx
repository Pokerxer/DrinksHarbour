import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Product Not Found</h1>
        <p className="text-gray-600 mb-8">
          This product is no longer available or may have been removed from our catalogue.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/shop"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-lg font-semibold hover:from-red-800 hover:to-red-950 transition-all shadow-md"
          >
            Browse the Shop
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-200 text-red-800 rounded-lg font-semibold hover:border-red-700 hover:bg-red-50 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
