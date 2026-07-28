import React from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';

// Rendered by notFound() in the post page, so this UI now ships with a real
// HTTP 404 instead of the 200 the inline version used to return.
export default function BlogPostNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-700">
          <Icon.PiBookOpenTextBold size={30} />
        </div>
        <h1 className="mb-2 text-2xl font-black text-gray-900">
          Article not found
        </h1>
        <p className="mb-6 text-gray-500">
          This article may have been moved or removed.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-red-700 to-red-900 px-6 py-3 text-sm font-bold text-white"
        >
          <Icon.PiArrowLeft size={15} /> Back to Blog
        </Link>
      </div>
    </div>
  );
}
