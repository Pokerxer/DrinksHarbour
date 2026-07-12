import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BrandClient from './BrandClient';

const API_URL   = process.env.NEXT_PUBLIC_API_URL  || '';
const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL  || 'https://www.drinksharbour.com';
const SITE_NAME = 'DrinksHarbour';

export const dynamic = 'force-dynamic';

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function fetchBrand(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/brands/slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data ?? data ?? null;
  } catch {
    return null;
  }
}

// ─── Metadata ──────────────────────────────────────────────────────────────────

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

  const brandUrl   = brand.canonicalUrl || `${BASE_URL}/brands/${slug}`;
  const title      = buildTitle(brand);
  const description = buildDescription(brand);
  const keywords   = buildKeywords(brand);

  const ogImage =
    brand.bannerImage?.url ||
    brand.featuredImage?.url ||
    brand.logo?.url ||
    brand.logoVariants?.primary ||
    `${BASE_URL}/images/logo.png`;

  return {
    title: { absolute: `${title} | ${SITE_NAME}` },
    description,
    keywords,
    robots: { index: true, follow: true, 'max-image-preview': 'large' },
    alternates: { canonical: brandUrl },

    openGraph: {
      type:     'website',
      url:      brandUrl,
      siteName: SITE_NAME,
      title:    `${title} | ${SITE_NAME}`,
      description,
      images:   [{ url: ogImage, width: 1200, height: 630, alt: brand.name }],
      locale:   'en_NG',
    },

    twitter: {
      card:        'summary_large_image',
      site:        '@DrinkHarbour',
      title:       `${title} | ${SITE_NAME}`,
      description,
      images:      [ogImage],
    },
  };
}

// ─── Builders ──────────────────────────────────────────────────────────────────

function buildTitle(brand: any): string {
  if (brand.metaTitle) {
    return brand.metaTitle.replace(/\s*\|\s*DrinksHarbour\s*$/i, '').trim();
  }
  const parts: string[] = [brand.name];
  if (brand.tagline) parts.push(brand.tagline);
  else if (brand.countryOfOrigin) parts.push(`Premium ${brand.primaryCategory ?? 'Drinks'} from ${brand.countryOfOrigin}`);
  return parts.join(' — ');
}

function buildDescription(brand: any): string {
  if (brand.metaDescription) return brand.metaDescription;
  const base = brand.shortDescription || brand.description?.slice(0, 200) || `Explore ${brand.name} products on DrinksHarbour.`;
  const suffix = ` Shop ${brand.name} in Nigeria with fast delivery.`;
  return (base + suffix).slice(0, 320);
}

function buildKeywords(brand: any): string[] {
  if (Array.isArray(brand.metaKeywords) && brand.metaKeywords.length) return brand.metaKeywords;
  const kw: string[] = [
    brand.name,
    `${brand.name} Nigeria`,
    `buy ${brand.name} Nigeria`,
    `${brand.name} price Nigeria`,
    `${brand.name} online`,
  ];
  if (brand.primaryCategory) kw.push(`${brand.primaryCategory} brands Nigeria`);
  if (brand.countryOfOrigin) kw.push(`${brand.countryOfOrigin} ${brand.primaryCategory ?? 'drinks'}`);
  return kw;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brand = await fetchBrand(slug);
  if (!brand) notFound();

  const brandUrl = brand.canonicalUrl || `${BASE_URL}/brands/${slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Brand',
    name: brand.name,
    description: brand.shortDescription || brand.description,
    url: brandUrl,
    logo: brand.logo?.url || brand.logoVariants?.primary,
    ...(brand.founded ? { foundingDate: String(brand.founded) } : {}),
    ...(brand.countryOfOrigin ? { countryOfOrigin: brand.countryOfOrigin } : {}),
    ...(brand.website ? { sameAs: [brand.website] } : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',   item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Brands', item: `${BASE_URL}/brands` },
      { '@type': 'ListItem', position: 3, name: brand.name, item: brandUrl },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <BrandClient brand={brand} />
    </>
  );
}
