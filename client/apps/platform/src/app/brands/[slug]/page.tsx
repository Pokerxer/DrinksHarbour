import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import * as Icon from 'react-icons/pi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

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
    const list =
      data?.data?.products ?? data?.products ?? data?.data ?? [];
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

  const facts: { icon: React.ComponentType<any>; label: string; value: string }[] = [
    brand.countryOfOrigin && {
      icon: Icon.PiGlobeHemisphereWestBold,
      label: 'Country of origin',
      value: brand.region
        ? `${brand.region}, ${brand.countryOfOrigin}`
        : brand.countryOfOrigin,
    },
    brand.founded && {
      icon: Icon.PiCalendarBlankBold,
      label: 'Founded',
      value: String(brand.founded),
    },
    brand.founderName && {
      icon: Icon.PiUserBold,
      label: 'Founder',
      value: brand.founderName,
    },
    brand.brandType && {
      icon: Icon.PiFactoryBold,
      label: 'Type',
      value: String(brand.brandType).replace(/_/g, ' '),
    },
    brand.primaryCategory && {
      icon: Icon.PiWineBold,
      label: 'Category',
      value: String(brand.primaryCategory).replace(/_/g, ' '),
    },
    hq && { icon: Icon.PiMapPinBold, label: 'Headquarters', value: hq },
  ].filter(Boolean) as any;

  const socials = Object.entries(brand.socialMedia || {}).filter(
    ([, v]) => typeof v === 'string' && (v as string).startsWith('http')
  ) as [string, string][];

  return (
    <div className="min-h-screen bg-gray-100">
      {jsonLd.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
        }}
      >
        {heroImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        <div className="container relative mx-auto px-4 py-10 sm:py-14">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-white/70">
              <li>
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/brands" className="hover:text-white">
                  Brands
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-white">
                {brand.name}
              </li>
            </ol>
          </nav>

          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {/* Logo */}
            <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-xl sm:h-28 sm:w-28">
              {brand.logo?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logo.url}
                  alt={brand.logo.alt || `${brand.name} logo`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span
                  className="text-4xl font-black"
                  style={{ color: primary }}
                >
                  {brand.name?.charAt(0)}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-black text-white drop-shadow sm:text-4xl">
                {brand.name}
              </h1>
              {brand.tagline && (
                <p className="mt-1 text-sm font-medium text-white/80 sm:text-base">
                  {brand.tagline}
                </p>
              )}
              {/* Meta chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {brand.countryOfOrigin && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Icon.PiMapPinBold className="h-3 w-3" />
                    {brand.countryOfOrigin}
                  </span>
                )}
                {brand.founded && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                    <Icon.PiCalendarBlankBold className="h-3 w-3" />
                    Est. {brand.founded}
                  </span>
                )}
                {brand.primaryCategory && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium capitalize text-white backdrop-blur-sm">
                    <Icon.PiWineBold className="h-3 w-3" />
                    {String(brand.primaryCategory).replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>

            <Link
              href={shopHref}
              className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-gray-900 shadow-lg transition hover:bg-gray-100"
            >
              <Icon.PiShoppingCartBold className="h-4 w-4" />
              Shop {brand.name}
            </Link>
          </div>
        </div>
      </section>

      <div className="container mx-auto space-y-8 px-4 py-8">
        {/* ── About + facts ─────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {(brand.description || brand.shortDescription) && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-bold text-gray-900">
                  About {brand.name}
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {brand.description || brand.shortDescription}
                </p>
              </section>
            )}

            {brand.story && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-bold text-gray-900">
                  The Story
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {brand.story}
                </p>
              </section>
            )}
          </div>

          {/* Facts card */}
          <aside className="space-y-6">
            {facts.length > 0 && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-gray-900">
                  Brand Facts
                </h2>
                <dl className="space-y-3">
                  {facts.map(({ icon: Ic, label, value }) => (
                    <div key={label} className="flex items-start gap-3">
                      <span
                        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${primary}15`, color: primary }}
                      >
                        <Ic className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {label}
                        </dt>
                        <dd className="text-sm font-medium capitalize text-gray-800">
                          {value}
                        </dd>
                      </div>
                    </div>
                  ))}
                </dl>

                {Array.isArray(brand.specializations) &&
                  brand.specializations.length > 0 && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                        Known for
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {brand.specializations.map((s: string) => (
                          <span
                            key={s}
                            className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium capitalize text-gray-600"
                          >
                            {String(s).replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </section>
            )}

            {(brand.website || socials.length > 0) && (
              <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-lg font-bold text-gray-900">
                  Connect
                </h2>
                {brand.website && (
                  <a
                    href={brand.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  >
                    <Icon.PiGlobeBold className="h-4 w-4 text-gray-400" />
                    <span className="truncate">
                      {brand.website.replace(/^https?:\/\//, '')}
                    </span>
                    <Icon.PiArrowUpRightBold className="h-3 w-3 text-gray-400" />
                  </a>
                )}
                {socials.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
                        >
                          <Ic className="h-4 w-4" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </section>
            )}
          </aside>
        </div>

        {/* ── Products ──────────────────────────────────────────────────── */}
        {products.length > 0 && (
          <section aria-labelledby="brand-products-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2
                id="brand-products-heading"
                className="text-lg font-bold text-gray-900 sm:text-xl"
              >
                {brand.name} Products
              </h2>
              <Link
                href={shopHref}
                className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
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
                    className="group overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="aspect-square overflow-hidden bg-gray-50">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-300">
                          <Icon.PiWineBold className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-semibold text-gray-800 group-hover:text-gray-900">
                        {p.name}
                      </p>
                      {price !== null && (
                        <p
                          className="mt-1 text-sm font-black"
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

        {/* ── Bottom CTA ────────────────────────────────────────────────── */}
        <section
          className="overflow-hidden rounded-2xl p-8 text-center"
          style={{
            background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
          }}
        >
          <h2 className="text-xl font-black text-white sm:text-2xl">
            Shop authentic {brand.name} in Nigeria
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
            Genuine products, secure checkout and fast delivery across Nigeria
            from DrinksHarbour.
          </p>
          <Link
            href={shopHref}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-lg transition hover:bg-gray-100"
          >
            <Icon.PiShoppingCartBold className="h-4 w-4" />
            Browse all {brand.name} products
          </Link>
        </section>
      </div>
    </div>
  );
}
