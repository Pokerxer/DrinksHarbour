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

async function fetchCategory(slug: string) {
  try {
    // Short revalidate so admin edits show up within minutes, not an hour.
    const res = await fetch(`${API_URL}/api/categories/slug/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.category ?? data?.data ?? null;
  } catch {
    return null;
  }
}

// The search endpoint resolves `category` by ObjectId (or exact name) — never
// by slug — so pass the id we already have from the slug lookup.
async function fetchCategoryProducts(categoryId: string) {
  try {
    const res = await fetch(
      `${API_URL}/api/products/search?category=${encodeURIComponent(categoryId)}&limit=8`,
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

// The category's published subcategories — surfaced as style chips that deep
// link into the shop's combined ?category=&subcategory= canonical form.
async function fetchSubcategories(categoryId: string): Promise<any[]> {
  try {
    const res = await fetch(
      `${API_URL}/api/subcategories/by-category/${encodeURIComponent(categoryId)}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list =
      data?.data?.subcategories ?? data?.subcategories ?? data?.data ?? [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Related shelves: other published categories, same alcohol family first.
async function fetchRelatedCategories(category: any): Promise<any[]> {
  try {
    const res = await fetch(`${API_URL}/api/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const list = data?.data?.categories ?? data?.categories ?? data?.data ?? [];
    if (!Array.isArray(list)) return [];
    const others = list.filter((c: any) => c?.slug && c.slug !== category.slug);
    const sameFamily = others.filter(
      (c: any) => c.alcoholCategory === category.alcoholCategory
    );
    const rest = others.filter(
      (c: any) => c.alcoholCategory !== category.alcoholCategory
    );
    return [...sameFamily, ...rest].slice(0, 6);
  } catch {
    return [];
  }
}

// ─── Text formatting ──────────────────────────────────────────────────────────
// Category copy is stored with HTML markup (<p>, <br>, entities). Convert it to
// clean paragraph strings for rendering, metadata and JSON-LD.

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, '—')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function toParagraphs(raw?: string): string[] {
  if (!raw) return [];
  const text = decodeEntities(
    raw
      .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  );
  return text
    .split(/\n+/)
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function plainText(raw?: string): string {
  return toParagraphs(raw).join(' ');
}

/**
 * Cap a page title so `${title} | DrinksHarbour` stays within Google's
 * ~60-char SERP display, trimming to a word boundary. (SEO "3 Kings" — King 1)
 */
function capTitle(raw: string): string {
  const budget = 60 - ` | ${SITE_NAME}`.length; // 60 − 15 = 45
  if (raw.length <= budget) return raw;
  return raw.slice(0, budget).replace(/\s+\S*$/, '').trim();
}

/** First keyword-bearing sentence for the hero lede (SEO "3 Kings" — King 3). */
function firstSentence(raw?: string, max = 180): string {
  const text = plainText(raw);
  if (!text) return '';
  const sentence = text.split(/(?<=[.!?])\s/)[0] || text;
  return sentence.length > max ? `${sentence.slice(0, max).trim()}…` : sentence;
}

type Seg = { text: string; href?: string };

// Like toParagraphs, but preserves internal <a href> links — AI-written
// category copy carries contextual links to subcategory/product/brand detail
// pages (only same-site hrefs survive; everything else renders as text).
function toRichParagraphs(raw?: string): Seg[][] {
  if (!raw) return [];
  const html = raw
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<(?!\/?a[\s>])[^>]+>/g, '');
  return html
    .split(/\n+/)
    .map((line) => {
      const segs: Seg[] = [];
      const re = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line))) {
        if (m.index > last) segs.push({ text: line.slice(last, m.index) });
        const href = m[1];
        segs.push({
          text: m[2].replace(/<[^>]+>/g, ''),
          ...(href.startsWith('/') ? { href } : {}),
        });
        last = m.index + m[0].length;
      }
      if (last < line.length) segs.push({ text: line.slice(last) });
      return segs
        .map((s) => ({ ...s, text: decodeEntities(s.text).replace(/\s+/g, ' ') }))
        .filter((s) => s.text.trim());
    })
    .filter((p) => p.length);
}

function RichText({ segs, linkColor }: { segs: Seg[]; linkColor: string }) {
  return (
    <>
      {segs.map((s, i) =>
        s.href ? (
          <Link
            key={i}
            href={s.href}
            className="font-medium underline decoration-1 underline-offset-2 transition hover:opacity-80"
            style={{ color: linkColor }}
          >
            {s.text}
          </Link>
        ) : (
          <span key={i}>{s.text}</span>
        )
      )}
    </>
  );
}

function label(v?: string): string {
  return String(v || '').replace(/_/g, ' ');
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await fetchCategory(slug);

  if (!category) {
    return {
      title: { absolute: `Category Not Found | ${SITE_NAME}` },
      description: 'This category could not be found on DrinksHarbour.',
      robots: { index: false, follow: false },
    };
  }

  const name = category.displayName || category.name;
  const url = `${BASE_URL}/categories/${slug}`;
  const title = capTitle(
    category.metaTitle || `${name} — Buy ${name} Drinks Online in Nigeria`,
  );
  const description = (
    plainText(category.metaDescription) ||
    plainText(category.shortDescription) ||
    plainText(category.description) ||
    `Shop authentic ${name} on DrinksHarbour with fast delivery across Nigeria.${category.tagline ? ` ${category.tagline}.` : ''}`
  ).slice(0, 160);
  const ogImage =
    category.ogImage ||
    category.bannerImage?.url ||
    category.featuredImage?.url ||
    `${BASE_URL}/og-default.jpg`;

  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    keywords: [
      name,
      `${name} price in Nigeria`,
      `buy ${name} online`,
      label(category.type),
      label(category.subType),
      ...(category.metaKeywords || []),
    ].filter(Boolean),
    alternates: { canonical: url, languages: { "en-NG": url, "x-default": url } },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: 'website',
      images: [{ url: ogImage, alt: category.featuredImage?.alt || name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [category.twitterImage || ogImage],
    },
    robots:
      category.status && category.status !== 'published'
        ? { index: false, follow: true }
        : undefined,
  };
}

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

function buildJsonLd(category: any, slug: string, products: any[]) {
  const name = category.displayName || category.name;
  const url = `${BASE_URL}/categories/${slug}`;

  // Categories aren't a Brand — model the page as a CollectionPage whose main
  // entity is the ItemList of products we actually render.
  const collectionLd: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#collection`,
    name,
    url,
    ...(plainText(category.description) || plainText(category.shortDescription)
      ? {
          description:
            plainText(category.description) ||
            plainText(category.shortDescription),
        }
      : {}),
    ...(products.length
      ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: products.length,
            itemListElement: products.map((p: any, i: number) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.name,
              url: `${BASE_URL}/product/${p.slug || p._id}`,
            })),
          },
        }
      : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Categories',
        item: `${BASE_URL}/categories`,
      },
      { '@type': 'ListItem', position: 3, name, item: url },
    ],
  };

  return [collectionLd, breadcrumbLd];
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

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = await fetchCategory(slug);
  if (!category) notFound();

  const [products, subcategories, relatedCategories] = await Promise.all([
    fetchCategoryProducts(String(category._id)),
    fetchSubcategories(String(category._id)),
    fetchRelatedCategories(category),
  ]);

  const name = category.displayName || category.name;

  // FAQ — built from real data so the answers stay true per category.
  const prices = products
    .map(productPrice)
    .filter((n): n is number => n !== null);
  const minPrice = prices.length ? Math.min(...prices) : null;
  const maxPrice = prices.length ? Math.max(...prices) : null;

  const faqs: { q: string; a: string }[] = [
    {
      q: `Is the ${name} sold on DrinksHarbour original?`,
      a: `Yes. Every ${name} product sold on DrinksHarbour is 100% authentic, sourced through vetted distributors and checked before dispatch.`,
    },
    minPrice !== null && {
      q: `How much does ${name} cost in Nigeria?`,
      a:
        maxPrice !== null && maxPrice !== minPrice
          ? `${name} prices on DrinksHarbour currently range from ${NGN.format(minPrice)} to ${NGN.format(maxPrice)}, depending on the brand and bottle size.`
          : `${name} is currently available on DrinksHarbour from ${NGN.format(minPrice)}. Prices vary by brand and bottle size.`,
    },
    {
      q: `Does DrinksHarbour deliver ${name} across Nigeria?`,
      a: `Yes. Order ${name} online and get it delivered across Nigeria, with same-day options available in Abuja.`,
    },
    products.length > 0 && {
      q: `Which ${name} products can I buy online?`,
      a: `DrinksHarbour stocks ${name} products including ${products
        .slice(0, 3)
        .map((p: any) => p.name)
        .join(', ')}${products.length > 3 ? ' and more' : ''}. See the full range on the ${name} shop page.`,
    },
  ].filter(Boolean) as { q: string; a: string }[];

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const jsonLd = [...buildJsonLd(category, slug, products), faqLd];
  // No brandColors on categories — lean on the stored accent color over the
  // same deep-ink base the brand labels use.
  const primary = category.color || '#7C1D1D';
  const secondary = '#1A1A2E';
  const shopHref = `/shop?category=${encodeURIComponent(category.slug)}`;
  const heroImage = category.bannerImage?.url || category.featuredImage?.url;

  // King 2 (H1) — keyword-rich heading, falls back to the category name.
  const heading = category.seoH1 || name;
  // King 3 (first paragraph) — a keyword-bearing lede high on the page.
  const seoLede =
    firstSentence(category.shortDescription) ||
    firstSentence(category.description) ||
    `Buy ${name} online in Nigeria — fast delivery across Lagos, Abuja & nationwide on DrinksHarbour.`;

  // Provenance line for the label eyebrow: "SPIRITS · 124 PRODUCTS"
  const eyebrow = [
    label(category.alcoholCategory),
    category.productCount > 0 ? `${category.productCount} products` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const facts: { label: string; value: string }[] = [
    category.type && { label: 'Type', value: label(category.type) },
    category.subType && { label: 'Style', value: label(category.subType) },
    category.alcoholCategory && {
      label: 'Serving',
      value: label(category.alcoholCategory),
    },
    category.productCount > 0 && {
      label: 'Selection',
      value: `${category.productCount} products`,
    },
    category.averageProductPrice > 0 && {
      label: 'Avg. bottle',
      value: NGN.format(category.averageProductPrice),
    },
  ].filter(Boolean) as any;

  const monogram = (name || '?').charAt(0).toUpperCase();

  const descriptionParas = toRichParagraphs(category.description);
  const aboutParas = descriptionParas.length
    ? descriptionParas
    : toRichParagraphs(category.shortDescription);

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
@keyframes cp-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.cp-rise { animation: cp-rise 0.7s cubic-bezier(0.22,1,0.36,1) both; }
.cp-rise-2 { animation-delay: 0.12s; }
.cp-rise-3 { animation-delay: 0.24s; }
.cp-dropcap::first-letter {
  float: left;
  font-size: 3.1em;
  line-height: 0.85;
  padding-right: 0.12em;
  padding-top: 0.05em;
  font-weight: 600;
}
@media (prefers-reduced-motion: reduce) {
  .cp-rise, .cp-rise-2, .cp-rise-3 { animation: none; }
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
        {/* Engraved monogram — the cellar stamp, bleeding off the right edge */}
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
                <Link
                  href="/categories"
                  className="transition hover:text-white"
                >
                  Categories
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-white/90">
                {name}
              </li>
            </ol>
          </nav>

          <div className="mx-auto max-w-2xl text-center">
            {/* Emblem tile — the category's icon, or its engraved initial */}
            <div className="cp-rise mx-auto mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-white p-3 shadow-2xl ring-4 ring-white/10 sm:h-28 sm:w-28">
              {category.thumbnailImage?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={category.thumbnailImage.url}
                  alt={category.thumbnailImage.alt || `${name} category`}
                  className="h-full w-full object-contain"
                />
              ) : category.icon ? (
                <span aria-hidden="true" className="text-5xl leading-none">
                  {category.icon}
                </span>
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
              <p className="cp-rise cp-rise-2 mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
                {eyebrow}
              </p>
            )}

            <h1
              className={`${fraunces.className} cp-rise cp-rise-2 text-5xl font-semibold text-white drop-shadow-sm sm:text-6xl`}
            >
              {heading}
            </h1>

            <div className="cp-rise cp-rise-3 mx-auto mt-5 max-w-xs">
              <LabelRule />
            </div>

            {category.tagline && (
              <p
                className={`${fraunces.className} cp-rise cp-rise-3 mt-4 text-lg italic text-white/85 sm:text-xl`}
              >
                {category.tagline}
              </p>
            )}

            {seoLede && (
              <p className="cp-rise cp-rise-3 mx-auto mt-5 max-w-2xl text-[15px] leading-7 text-white/80">
                {seoLede}
              </p>
            )}

            <div className="cp-rise cp-rise-3 mt-8">
              <Link
                href={shopHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                style={{ color: primary }}
              >
                <Icon.PiShoppingCartBold className="h-4 w-4" />
                Shop {name}
              </Link>
            </div>
          </div>
        </div>

        {/* Fine print — the strip at the foot of every label */}
        <div className="relative border-t border-white/10 bg-black/20">
          <p className="container mx-auto px-4 py-2.5 text-center text-[10px] uppercase tracking-[0.22em] text-white/50">
            Authentic {name} · Delivered across Nigeria by DrinksHarbour
          </p>
        </div>
      </section>

      {/* ── Specimen fact strip ──────────────────────────────────────────── */}
      {facts.length > 0 && (
        <section
          aria-label={`${name} facts`}
          className="container mx-auto px-4"
        >
          <div className="-mt-0 grid grid-cols-2 divide-gray-100 rounded-b-2xl border border-t-0 border-gray-200 bg-white shadow-sm sm:grid-cols-3 lg:flex lg:divide-x">
            {facts.map(({ label: factLabel, value }: any) => (
              <div
                key={factLabel}
                className="min-w-0 flex-1 border-b border-gray-100 px-5 py-4 last:border-b-0 sm:border-b-0"
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
                  {factLabel}
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
        {/* ── The cellar — about ────────────────────────────────────────── */}
        {aboutParas.length > 0 && (
          <section
            aria-labelledby="category-about-heading"
            className="grid gap-8 lg:grid-cols-12"
          >
            <div className="lg:col-span-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                The category
              </p>
              <h2
                id="category-about-heading"
                className={`${fraunces.className} mt-2 text-3xl text-gray-900`}
              >
                About {name}
              </h2>
              <div className="mt-4 max-w-[9rem]">
                <LabelRule tone={`${primary}55`} />
              </div>
            </div>

            {aboutParas.length > 0 && (
              <div className="space-y-6 lg:col-span-8">
                <div className="space-y-4">
                  {/* Lead paragraph — serif with drop cap */}
                  <p
                    className={`${fraunces.className} cp-dropcap text-lg leading-relaxed text-gray-700`}
                  >
                    <RichText segs={aboutParas[0]} linkColor={primary} />
                  </p>
                  {aboutParas.slice(1).map((para, i) => (
                    <p key={i} className="text-[15px] leading-7 text-gray-600">
                      <RichText segs={para} linkColor={primary} />
                    </p>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Browse by style — subcategories ───────────────────────────── */}
        {subcategories.length > 0 && (
          <section aria-labelledby="category-subcategories-heading">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                  Browse by style
                </p>
                <h2
                  id="category-subcategories-heading"
                  className={`${fraunces.className} mt-1 text-3xl text-gray-900`}
                >
                  {name} styles
                </h2>
              </div>
              <Link
                href={shopHref}
                className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-semibold hover:underline"
                style={{ color: primary }}
              >
                Shop all {name}
                <Icon.PiArrowRightBold className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {subcategories.map((s: any) => {
                const sColor = s.color || primary;
                const sName = s.displayName || s.name;
                return (
                  <Link
                    key={s.slug}
                    href={`/categories/${category.slug}/${s.slug}`}
                    className="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-gray-50 p-2">
                      {s.thumbnailImage?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.thumbnailImage.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      ) : s.icon ? (
                        <span aria-hidden="true" className="text-2xl">
                          {s.icon}
                        </span>
                      ) : (
                        <span
                          className={`${fraunces.className} text-2xl font-semibold`}
                          style={{ color: sColor }}
                        >
                          {(sName || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span
                      className={`${fraunces.className} mt-3 line-clamp-1 text-base capitalize text-gray-900`}
                    >
                      {sName}
                    </span>
                    {(s.productCount ?? 0) > 0 && (
                      <span className="mt-1 line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                        {s.productCount} products
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Products ──────────────────────────────────────────────────── */}
        {products.length > 0 && (
          <section aria-labelledby="category-products-heading">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                  The collection
                </p>
                <h2
                  id="category-products-heading"
                  className={`${fraunces.className} mt-1 text-3xl text-gray-900`}
                >
                  {name} products
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

        {/* ── Related categories ────────────────────────────────────────── */}
        {relatedCategories.length > 0 && (
          <section aria-labelledby="related-categories-heading">
            <div className="mb-6 flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                  More shelves
                </p>
                <h2
                  id="related-categories-heading"
                  className={`${fraunces.className} mt-1 text-3xl text-gray-900`}
                >
                  Related categories
                </h2>
              </div>
              <Link
                href="/categories"
                className="inline-flex flex-shrink-0 items-center gap-1 text-sm font-semibold hover:underline"
                style={{ color: primary }}
              >
                All categories
                <Icon.PiArrowRightBold className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
              {relatedCategories.map((c: any) => {
                const cColor = c.color || '#7C1D1D';
                const cName = c.displayName || c.name;
                return (
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    className="group flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-gray-100 bg-gray-50 p-2">
                      {c.thumbnailImage?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.thumbnailImage.url}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-contain"
                        />
                      ) : c.icon ? (
                        <span aria-hidden="true" className="text-2xl">
                          {c.icon}
                        </span>
                      ) : (
                        <span
                          className={`${fraunces.className} text-2xl font-semibold`}
                          style={{ color: cColor }}
                        >
                          {(cName || '?').charAt(0).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span
                      className={`${fraunces.className} mt-3 line-clamp-1 text-base text-gray-900`}
                    >
                      {cName}
                    </span>
                    {c.type && (
                      <span className="mt-1 line-clamp-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                        {label(c.type)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ── FAQ ───────────────────────────────────────────────────────── */}
        {faqs.length > 0 && (
          <section aria-labelledby="category-faq-heading">
            <div className="mb-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">
                Good to know
              </p>
              <h2
                id="category-faq-heading"
                className={`${fraunces.className} mt-1 text-3xl text-gray-900`}
              >
                Frequently asked questions
              </h2>
            </div>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {faqs.map((f) => (
                <details key={f.q} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
                    <span
                      className={`${fraunces.className} text-base text-gray-900`}
                    >
                      {f.q}
                    </span>
                    <Icon.PiPlusBold
                      aria-hidden="true"
                      className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                    />
                  </summary>
                  <p className="px-6 pb-5 text-sm leading-7 text-gray-600">
                    {f.a}
                  </p>
                </details>
              ))}
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
              Shop authentic {name}
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
              Browse all {name} products
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
