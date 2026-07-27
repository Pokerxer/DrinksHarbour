import type { Metadata } from "next";
import Link from "next/link";

// Without this file Next.js falls back to its bare `__next_error__` shell, which
// renders a literally empty <body> — every 404 (a retired category slug, a typo,
// a stale inbound link) looked like a broken site to users and crawlers alike.

export const metadata: Metadata = {
  // `absolute` — the root layout's title template already appends the site name.
  title: { absolute: "Page Not Found | DrinksHarbour" },
  description:
    "The page you're looking for doesn't exist. Browse our catalogue of authentic spirits, wines and beers delivered across Nigeria.",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/shop", label: "All Products" },
  { href: "/categories", label: "Categories" },
  { href: "/brands", label: "Brands" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact Us" },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4 py-16">
      <div className="text-center max-w-lg">
        <p className="text-6xl font-black text-red-800 mb-2">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Page Not Found</h1>
        <p className="text-gray-600 mb-8">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
          It may have been a category or product we no longer stock.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center mb-10">
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

        {/* Real crawlable links so a 404 still hands search engines somewhere to go. */}
        <nav aria-label="Popular pages">
          <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">
            Popular pages
          </p>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-red-800 hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
