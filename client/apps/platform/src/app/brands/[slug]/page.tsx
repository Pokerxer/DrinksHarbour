import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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

// Force dynamic rendering — root layout uses headers() for tenant resolution,
// which makes static pre-generation incompatible. Data is still cached via
// Next.js fetch cache (revalidate per fetch call).
export const dynamic = 'force-dynamic';

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchBrand(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/brands/slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.brand ?? data?.data ?? null;
  } catch {
    return null;
  }
}

async function fetchBrandProducts(brandName: string) {
  try {
    const res = await fetch(
      `${API_URL}/api/products/search?brand=${encodeURIComponent(brandName)}&limit=8`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.data?.products ?? data?.products ?? data?.data ?? [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await fetchBrand(slug);

  if (!brand) {
    return {
      title: { absolute: `Brand Not Found | ${SITE_NAME}` },
      description: 'This brand could not be found on DrinksHarbour.',
      robots: { index: false, follow: false },
    };
  }

  const url = `${BASE_URL}/brands/${slug}`;
  const title =
    brand.metaTitle ||
    `${brand.name} — Buy ${brand.name} Drinks Online in Nigeria`;
  const description = (
    brand.metaDescription ||
    brand.shortDescription ||
    brand.description ||
    `Shop authentic ${brand.name} drinks on DrinksHarbour with fast delivery across Nigeria.${brand.tagline ? ` ${brand.tagline}.` : ''}`
  ).slice(0, 160);
  const ogImage =
    brand.bannerImage?.url ||
    brand.featuredImage?.url ||
    brand.logo?.url ||
    `${BASE_URL}/images/logo.png`;

  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    keywords: [
      brand.name,
      `${brand.name} price in Nigeria`,
      `buy ${brand.name} online`,
      brand.primaryCategory,
      brand.countryOfOrigin,
      ...(brand.specializations || []),
    ].filter(Boolean),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: ogImage, alt: brand.logo?.alt || brand.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    robots:
      brand.status && brand.status !== 'active'
        ? { index: false, follow: true }
        : undefined,
  };
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function buildJsonLd(brand: any, slug: string) {
  const url = `${BASE_URL}/brands/${slug}`;
  const sameAs = Object.values(brand.socialMedia || {}).filter(
    (v) => typeof v === 'string' && v.startsWith('http')
  );

  const brandLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    '@id': `${url}#brand`,
    name: brand.name,
    url,
    ...(brand.legalName ? { legalName: brand.legalName } : {}),
    ...(brand.logo?.url ? { logo: brand.logo.url } : {}),
    ...(brand.description || brand.shortDescription
      ? { description: brand.description || brand.shortDescription }
      : {}),
    ...(brand.tagline ? { slogan: brand.tagline } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Brands',
        item: `${BASE_URL}/brands`,
      },
      { '@type': 'ListItem', position: 3, name: brand.name, item: url },
    ],
  };

  return [brandLd, breadcrumbLd];
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function productImage(p: any): string | undefined {
  return (
    p.primaryImage?.url ||
    p.image ||
    p.thumbnail ||
    (Array.isArray(p.images) ? p.images[0]?.url || p.images[0] : undefined)
  );
}

function productPrice(p: any): number | null {
  const n = Number(
    p.platformSellingPrice ?? p.price ?? p.minPrice ?? p.sellingPrice
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

const NGN = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
});

const SOCIAL_ICONS: Record<string, React.ComponentType<any>> = {
  instagram: Icon.PiInstagramLogoBold,
  facebook: Icon.PiFacebookLogoBold,
  twitter: Icon.PiTwitterLogoBold,
  x: Icon.PiXLogoBold,
  youtube: Icon.PiYoutubeLogoBold,
  tiktok: Icon.PiTiktokLogoBold,
  linkedin: Icon.PiLinkedinLogoBold,
};

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await fetchBrand(slug);
  if (!brand) notFound();

  const products = await fetchBrandProducts(brand.name);
  const jsonLd = buildJsonLd(brand, slug);

  const primary = brand.brandColors?.primary || '#7C1D1D';
  const secondary = brand.brandColors?.secondary || '#1A1A2E';
  const shopHref = `/shop?brand=${encodeURIComponent(brand.name)}`;
  const heroImage = brand.bannerImage?.url || brand.featuredImage?.url;

  const hq = [
    brand.headquarters?.city,
    brand.headquarters?.state,
    brand.headquarters?.country,
  ]
    .filter(Boolean)
    .join(', ');

  // Provenance line for the label eyebrow: "EST. 1765 · COGNAC, FRANCE"
  const eyebrow = [
    brand.founded ? `Est. ${brand.founded}` : null,
    [brand.region, brand.countryOfOrigin].filter(Boolean).join(', ') || null,
  ]
    .filter(Boolean)
    .join(' · ');

  const facts: { label: string; value: string }[] = [
    brand.countryOfOrigin && {
      label: 'Origin',
      value: brand.region
        ? `${brand.region}, ${brand.countryOfOrigin}`
        : brand.countryOfOrigin,
    },
    brand.founded && { label: 'Founded', value: String(brand.founded) },
    brand.founderName && { label: 'Founder', value: brand.founderName },
    brand.brandType && {
      label: 'House type',
      value: String(brand.brandType).replace(/_/g, ' '),
    },
    brand.primaryCategory && {
      label: 'Category',
      value: String(brand.primaryCategory).replace(/_/g, ' '),
    },
    hq && { label: 'Headquarters', value: hq },
  ].filter(Boolean) as any;

  const socials = Object.entries(brand.socialMedia || {}).filter(
    ([, v]) => typeof v === 'string' && (v as string).startsWith('http')
  ) as [string, string][];

  const monogram = (brand.name || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-100">
      {jsonLd.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* Load reveal + drop cap. Motion is opt-out via prefers-reduced-motion. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes bp-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.bp-rise { animation: bp-rise 0.7s cubic-bezier(0.22,1,0.36,1) both; }
.bp-rise-2 { animation-delay: 0.12s; }
.bp-rise-3 { animation-delay: 0.24s; }
.bp-dropcap::first-letter {
  float: left;
  font-size: 3.1em;
  line-height: 0.85;
  padding-right: 0.12em;
  padding-top: 0.05em;
  font-weight: 600;
}
@media (prefers-reduced-motion: reduce) {
  .bp-rise, .bp-rise-2, .bp-rise-3 { animation: none; }
}`,
        }}
      />

      {/* ── Hero — the label ─────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(150deg, ${primary} 0%, ${secondary} 100%)`,
        }}
      >
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        {/* Engraved monogram — the house crest, bleeding off the right edge */}
        <span
          aria-hidden="true"
          className={`${fraunces.className} pointer-events-none absolute -right-8 -top-16 select-none font-semibold leading-none text-transparent sm:-right-4`}
          style={{
            fontSize: 'clamp(16rem, 38vw, 30rem)',
            WebkitTextStroke: '1px rgba(255,255,255,0.14)',
          }}
        >
          {monogram}
        </span>
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10" />

        <div className="container relative mx-auto px-4 pb-16 pt-8 sm:pb-20 sm:pt-10">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-10">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-white/60">
              <li>
                <Link href="/" className="transition hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/brands" className="transition hover:text-white">
                  Brands
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-white/90">
                {brand.name}
              </li>
            </ol>
          </nav>

          <div className="mx-auto max-w-2xl text-center">
            {/* Logo tile */}
            <div className="bp-rise mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white p-3 shadow-2xl ring-4 ring-white/10 sm:h-28 sm:w-28">
              {brand.logo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logo.url}
                  alt={brand.logo.alt || `${brand.name} logo`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span
                  className={`${fraunces.className} text-5xl font-semibold`}
                  style={{ color: primary }}
                >
                  {monogram}
                </span>
              )}
            </div>

            {eyebrow && (
              <p className="bp-rise bp-rise-2 mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                {eyebrow}
              </p>
            )}

            <h1
              className={`${fraunces.className} bp-rise bp-rise-2 text-5xl font-semibold text-white drop-shadow-sm sm:text-6xl`}
            >
              {brand.name}
            </h1>

            <div className="bp-rise bp-rise-3 mx-auto mt-5 max-w-xs">
              <LabelRule />
            </div>

            {brand.tagline && (
              <p
                className={`${fraunces.className} bp-rise bp-rise-3 mt-4 text-lg italic text-white/85 sm:text-xl`}
              >
                {brand.tagline}
              </p>
            )}

            <div className="bp-rise bp-rise-3 mt-8">
              <Link
                href={shopHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{ color: primary }}
              >
                <Icon.PiShoppingCartBold className="h-4 w-4" />
                Shop {brand.name}
              </Link>
            </div>
          </div>
        </div>

        {/* Fine print — the strip at the foot of every label */}
        <div className="relative border-t border-white/10 bg-black/20">
          <p className="container mx-auto px-4 py-2.5 text-center text-[10px] uppercase tracking-[0.22em] text-white/50">
            Authentic {brand.name} · Delivered across Nigeria by DrinksHarbour
          </p>
        </div>
      </section>

      {/* ── Specimen fact strip ──────────────────────────────────────────── */}
      {facts.length > 0 && (
        <section
          aria-label={`${brand.name} facts`}
          className="container mx-auto px-4"
        >
          <div className="-mt-0 grid grid-cols-2 divide-gray-100 rounded-b-2xl border border-t-0 border-gray-200 bg-white shadow-sm sm:grid-cols-3 lg:flex lg:divide-x">
            {facts.map(({ label, value }: any) => (
              <div
                key={label}
                className="min-w-0 flex-1 border-b border-gray-100 px-5 py-4 last:border-b-0 sm:border-b-0"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                  {label}
                </p>
                <p
                  className={`${fraunces.className} mt-1 truncate text-base capitalize text-gray-900`}
                  title={value}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="container mx-auto space-y-12 px-4 py-10 sm:py-14">
        {/* ── The house — about + story ─────────────────────────────────── */}
        {(brand.description || brand.shortDescription || brand.story) && (
          <section
            aria-labelledby="brand-about-heading"
            className="grid gap-8 lg:grid-cols-12"
          >
            <div className="lg:col-span-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                The house
              </p>
              <h2
                id="brand-about-heading"
                className={`${fraunces.className} mt-2 text-3xl text-gray-900`}
              >
                About {brand.name}
              </h2>
              <div className="mt-4 max-w-[9rem]">
                <LabelRule tone={`${primary}55`} />
              </div>

              {Array.isArray(brand.specializations) &&
                brand.specializations.length > 0 && (
                  <div className="mt-6">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                      Known for
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.specializations.map((s: string) => (
                        <span
                          key={s}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium capitalize text-gray-600"
                        >
                          {String(s).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {(brand.website || socials.length > 0) && (
                <div className="mt-6">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    Connect
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {socials.map(([key, href]) => {
                      const Ic =
                        SOCIAL_ICONS[key.toLowerCase()] || Icon.PiLinkBold;
                      return (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          aria-label={`${brand.name} on ${key}`}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:text-gray-900"
                        >
                          <Ic className="h-4 w-4" />
                        </a>
                      );
                    })}
                    {brand.website && (
                      <a
                        href={brand.website}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition hover:text-gray-900"
                      >
                        <Icon.PiGlobeBold className="h-3.5 w-3.5" />
                        {brand.website.replace(/^https?:\/\/(www\.)?/, '')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6 lg:col-span-8">
              {(brand.description || brand.shortDescription) && (
                <p
                  className={`${fraunces.className} bp-dropcap whitespace-pre-line text-lg leading-relaxed text-gray-700`}
                >
                  {brand.description || brand.shortDescription}
                </p>
              )}
              {brand.story && (
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                    Our story
                  </p>
                  <p className="whitespace-pre-line text-sm leading-7 text-gray-600">
                    {brand.story}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Products ──────────────────────────────────────────────────── */}
        {products.length > 0 && (
          <section aria-labelledby="brand-products-heading">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                  The collection
                </p>
                <h2
                  id="brand-products-heading"
                  className={`${fraunces.className} mt-1 text-3xl text-gray-900`}
                >
                  {brand.name} products
                </h2>
              </div>
              <Link
                href={shopHref}
                className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-semibold hover:underline"
                style={{ color: primary }}
              >
                View all
                <Icon.PiArrowRightBold className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {products.map((p: any) => {
                const img = productImage(p);
                const price = productPrice(p);
                return (
                  <Link
                    key={p._id || p.slug}
                    href={`/product/${p.slug || p._id}`}
                    className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-50">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-contain p-4 transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Icon.PiWineBold className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100 p-3.5">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-800">
                        {p.name}
                      </p>
                      {price !== null && (
                        <p
                          className={`${fraunces.className} mt-1 text-base font-semibold`}
                          style={{ color: primary }}
                        >
                          {NGN.format(price)}
                        </p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Closing label band ────────────────────────────────────────── */}
        <section
          className="relative overflow-hidden rounded-2xl px-6 py-12 text-center sm:py-14"
          style={{
            background: `linear-gradient(150deg, ${primary} 0%, ${secondary} 100%)`,
          }}
        >
          <span
            aria-hidden="true"
            className={`${fraunces.className} pointer-events-none absolute -bottom-24 -left-6 select-none font-semibold leading-none text-transparent`}
            style={{
              fontSize: '16rem',
              WebkitTextStroke: '1px rgba(255,255,255,0.12)',
            }}
          >
            {monogram}
          </span>
          <div className="relative mx-auto max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
              {eyebrow || 'DrinksHarbour'}
            </p>
            <h2
              className={`${fraunces.className} mt-3 text-3xl text-white sm:text-4xl`}
            >
              Shop authentic {brand.name}
            </h2>
            <div className="mx-auto mt-5 max-w-[10rem]">
              <LabelRule />
            </div>
            <p className="mx-auto mt-4 text-sm leading-6 text-white/80">
              Genuine bottles, secure checkout and fast delivery across
              Nigeria.
            </p>
            <Link
              href={shopHref}
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold shadow-xl transition hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{ color: primary }}
            >
              <Icon.PiShoppingCartBold className="h-4 w-4" />
              Browse all {brand.name} products
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
