import type { Metadata } from 'next';
import Link from 'next/link';
import { Fraunces } from 'next/font/google';
import * as Icon from 'react-icons/pi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

// Display face for the "bottle label" treatment — soft old-style serif.
const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

// Force dynamic rendering — root layout uses headers() for tenant resolution.
// Data is still cached via the Next.js fetch cache (revalidate per fetch).
export const dynamic = 'force-dynamic';

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<any[]> {
  try {
    // Short revalidate so admin edits show up within minutes, not an hour.
    const res = await fetch(`${API_URL}/api/categories`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.data?.categories ?? data?.categories ?? data?.data ?? [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const PAGE_URL = `${BASE_URL}/categories`;
const PAGE_TITLE = 'Shop by Category — Buy Drinks Online in Nigeria';
const PAGE_DESCRIPTION =
  'Browse every drinks category on DrinksHarbour — whisky, cognac, wine, champagne, vodka, gin, beer, soft drinks and more. Authentic bottles delivered across Nigeria.';

export const metadata: Metadata = {
  title: { absolute: `${PAGE_TITLE} | ${SITE_NAME}` },
  description: PAGE_DESCRIPTION,
  keywords: [
    'drinks categories Nigeria',
    'buy whisky online Nigeria',
    'buy wine online Nigeria',
    'buy cognac online Nigeria',
    'spirits price in Nigeria',
    'DrinksHarbour categories',
  ],
  alternates: { canonical: PAGE_URL },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    siteName: SITE_NAME,
    title: `${PAGE_TITLE} | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    images: [{ url: `${BASE_URL}/images/logo.png`, alt: SITE_NAME }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PAGE_TITLE} | ${SITE_NAME}`,
    description: PAGE_DESCRIPTION,
    images: [`${BASE_URL}/images/logo.png`],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function label(v?: string): string {
  return String(v || '').replace(/_/g, ' ');
}

// Shelf assignment — editorial grouping by alcohol family.
function shelfOf(c: any): 'alcoholic' | 'soft' | 'other' {
  const a = c?.alcoholCategory;
  if (a === 'non_alcoholic' || a === 'alcohol_free') return 'soft';
  if (a === 'alcoholic' || a === 'low_alcohol' || a === 'mixed')
    return 'alcoholic';
  return 'other';
}

const SHELVES: {
  key: 'alcoholic' | 'soft' | 'other';
  eyebrow: string;
  title: string;
}[] = [
  { key: 'alcoholic', eyebrow: 'Shelf 01', title: 'Spirits, wine & beer' },
  { key: 'soft', eyebrow: 'Shelf 02', title: 'Soft & non-alcoholic' },
  { key: 'other', eyebrow: 'Shelf 03', title: 'More from the cellar' },
];

// The hairline—◆—hairline rule every good label carries.
function LabelRule({ tone = 'rgba(255,255,255,0.35)' }: { tone?: string }) {
  return (
    <div aria-hidden="true" className="flex items-center gap-3">
      <span className="h-px flex-1" style={{ backgroundColor: tone }} />
      <span
        className="h-1.5 w-1.5 rotate-45"
        style={{ backgroundColor: tone }}
      />
      <span className="h-px flex-1" style={{ backgroundColor: tone }} />
    </div>
  );
}

function CategoryCard({ c }: { c: any }) {
  const name = c.displayName || c.name;
  const color = c.color || '#7C1D1D';
  return (
    <Link
      href={`/categories/${c.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* Label header — the category's color band with its emblem */}
      <div
        className="relative flex h-24 items-center justify-center overflow-hidden"
        style={{
          background: `linear-gradient(150deg, ${color} 0%, #1A1A2E 100%)`,
        }}
      >
        <span
          aria-hidden="true"
          className={`${fraunces.className} pointer-events-none absolute -right-2 -top-8 select-none text-8xl font-semibold leading-none text-transparent`}
          style={{ WebkitTextStroke: '1px rgba(255,255,255,0.16)' }}
        >
          {(name || '?').charAt(0).toUpperCase()}
        </span>
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white p-2 shadow-xl ring-2 ring-white/20">
          {c.thumbnailImage?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.thumbnailImage.url}
              alt=""
              loading="lazy"
              className="h-full w-full object-contain"
            />
          ) : c.icon ? (
            <span aria-hidden="true" className="text-2xl leading-none">
              {c.icon}
            </span>
          ) : (
            <span
              className={`${fraunces.className} text-2xl font-semibold`}
              style={{ color }}
            >
              {(name || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        {(c.productCount ?? 0) > 0 && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white">
            {c.productCount} products
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4 text-center">
        {c.type && (
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
            {label(c.type)}
          </p>
        )}
        <h3
          className={`${fraunces.className} mt-1 text-lg text-gray-900 transition-colors group-hover:underline`}
        >
          {name}
        </h3>
        {(c.tagline || c.shortDescription) && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500">
            {c.tagline || c.shortDescription}
          </p>
        )}
        <span
          className="mt-auto inline-flex items-center justify-center gap-1 pt-3 text-xs font-semibold"
          style={{ color }}
        >
          Explore {name}
          <Icon.PiArrowRightBold className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoriesPage() {
  const categories = await fetchCategories();

  const sorted = [...categories].sort(
    (a, b) =>
      (b.productCount ?? 0) - (a.productCount ?? 0) ||
      String(a.name).localeCompare(String(b.name))
  );
  const totalProducts = sorted.reduce(
    (sum, c) => sum + (c.productCount ?? 0),
    0
  );

  const shelves = SHELVES.map((s) => ({
    ...s,
    items: sorted.filter((c) => shelfOf(c) === s.key),
  })).filter((s) => s.items.length > 0);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': `${PAGE_URL}#collection`,
      name: PAGE_TITLE,
      url: PAGE_URL,
      description: PAGE_DESCRIPTION,
      ...(sorted.length
        ? {
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: sorted.length,
              itemListElement: sorted.map((c: any, i: number) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: c.displayName || c.name,
                url: `${BASE_URL}/categories/${c.slug}`,
              })),
            },
          }
        : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Categories',
          item: PAGE_URL,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {jsonLd.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* Load reveal. Motion is opt-out via prefers-reduced-motion. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes cl-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.cl-rise { animation: cl-rise 0.7s cubic-bezier(0.22,1,0.36,1) both; }
.cl-rise-2 { animation-delay: 0.12s; }
.cl-rise-3 { animation-delay: 0.24s; }
@media (prefers-reduced-motion: reduce) {
  .cl-rise, .cl-rise-2, .cl-rise-3 { animation: none; }
}`,
        }}
      />

      {/* ── Hero — the cellar directory ──────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(150deg, #7C1D1D 0%, #1A1A2E 100%)',
        }}
      >
        <span
          aria-hidden="true"
          className={`${fraunces.className} pointer-events-none absolute -right-8 -top-16 select-none font-semibold leading-none text-transparent sm:-right-4`}
          style={{
            fontSize: 'clamp(16rem, 38vw, 30rem)',
            WebkitTextStroke: '1px rgba(255,255,255,0.14)',
          }}
        >
          C
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

        <div className="container relative mx-auto px-4 pb-16 pt-8 sm:pb-20 sm:pt-10">
          <nav aria-label="Breadcrumb" className="mb-10">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-white/60">
              <li>
                <Link href="/" className="transition hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-white/90">
                Categories
              </li>
            </ol>
          </nav>

          <div className="mx-auto max-w-2xl text-center">
            <p className="cl-rise mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
              The cellar directory
              {sorted.length > 0 && ` · ${sorted.length} categories`}
            </p>

            <h1
              className={`${fraunces.className} cl-rise cl-rise-2 text-5xl font-semibold text-white drop-shadow-sm sm:text-6xl`}
            >
              Shop by category
            </h1>

            <div className="cl-rise cl-rise-2 mx-auto mt-5 max-w-xs">
              <LabelRule />
            </div>

            <p
              className={`${fraunces.className} cl-rise cl-rise-3 mt-4 text-lg italic text-white/85 sm:text-xl`}
            >
              Every shelf of the harbour, from single malts to soft drinks.
            </p>

            <div className="cl-rise cl-rise-3 mt-8">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[#7C1D1D] shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Icon.PiShoppingCartBold className="h-4 w-4" />
                Browse all drinks
              </Link>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/10 bg-black/20">
          <p className="container mx-auto px-4 py-2.5 text-center text-[10px] uppercase tracking-[0.22em] text-white/50">
            {totalProducts > 0
              ? `${totalProducts.toLocaleString()} authentic products`
              : 'Authentic drinks'}{' '}
            · Delivered across Nigeria by DrinksHarbour
          </p>
        </div>
      </section>

      <div className="container mx-auto space-y-12 px-4 py-10 sm:py-14">
        {shelves.map((shelf) => (
          <section key={shelf.key} aria-labelledby={`shelf-${shelf.key}`}>
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                {shelf.eyebrow}
              </p>
              <h2
                id={`shelf-${shelf.key}`}
                className={`${fraunces.className} mt-1 text-3xl text-gray-900`}
              >
                {shelf.title}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {shelf.items.map((c: any) => (
                <CategoryCard key={c.slug} c={c} />
              ))}
            </div>
          </section>
        ))}

        {shelves.length === 0 && (
          <div className="py-20 text-center">
            <Icon.PiWineBold className="mx-auto h-12 w-12 text-gray-300" />
            <h2
              className={`${fraunces.className} mt-4 text-2xl text-gray-700`}
            >
              The cellar is being restocked
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Categories are on their way — browse the full shop meanwhile.
            </p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#7C1D1D] px-7 py-3 text-sm font-bold text-white shadow-xl"
            >
              <Icon.PiShoppingCartBold className="h-4 w-4" />
              Go to shop
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
