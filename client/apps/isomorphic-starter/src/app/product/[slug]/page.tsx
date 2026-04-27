import type { Metadata } from "next";
import ProductClient from "./ProductClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

async function fetchProductMeta(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/products/slug/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.product ?? data?.data ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = await fetchProductMeta(slug);

  if (!p) {
    return {
      title: "Product Not Found",
      description: "This product could not be found on DrinksHarbour.",
      robots: { index: false, follow: false },
    };
  }

  const brandName: string = p.brand?.name ?? "";
  const minPrice: number | undefined = p.priceRange?.min;
  const productUrl = p.seo?.canonicalUrl || `${BASE_URL}/product/${slug}`;

  // ── Title: prefer stored metaTitle, fallback to "Name by Brand"
  const title: string =
    p.seo?.metaTitle ||
    `${p.name}${brandName ? ` by ${brandName}` : ""}`;

  // ── Description: prefer stored metaDescription, build a rich fallback
  const description: string =
    p.seo?.metaDescription ||
    p.shortDescription ||
    buildDescription(p, brandName, minPrice);

  // ── Keywords: stored keywords + derived terms
  const keywords: string[] = [
    ...(p.seo?.metaKeywords ?? []),
    p.name,
    brandName,
    p.type,
    p.originCountry,
    "buy online Nigeria",
    "DrinksHarbour",
  ].filter(Boolean) as string[];

  // ── OG image: primary image → first image → fallback
  const ogImage: string =
    p.primaryImage?.url ||
    p.images?.[0]?.url ||
    `${BASE_URL}/og-default.jpg`;

  return {
    title,
    description,
    keywords,
    openGraph: {
      type: "website",
      url: productUrl,
      title: `${title} | DrinksHarbour`,
      description,
      images: [
        {
          url: ogImage,
          width: 800,
          height: 800,
          alt: p.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | DrinksHarbour`,
      description,
      images: [ogImage],
    },
    alternates: { canonical: productUrl },
  };
}

/** Build a rich description when no metaDescription is stored. */
function buildDescription(p: any, brandName: string, minPrice?: number): string {
  const parts: string[] = [`Buy ${p.name}`];
  if (brandName) parts.push(`by ${brandName}`);
  if (p.vintage) parts.push(`(${p.vintage})`);
  if (p.abv) parts.push(`– ${p.abv}% ABV`);
  if (p.originCountry) parts.push(`from ${p.originCountry}`);
  if (minPrice) parts.push(`from ₦${Math.round(minPrice).toLocaleString()}`);
  parts.push("with fast delivery across Nigeria on DrinksHarbour.");
  return parts.join(" ").slice(0, 160);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await fetchProductMeta(slug);

  // ── Build JSON-LD Product schema from stored SEO + product data
  const jsonLd = p ? buildJsonLd(p, slug) : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductClient slug={slug} />
    </>
  );
}

function buildJsonLd(p: any, slug: string) {
  const brandName: string = p.brand?.name ?? "";
  const minPrice: number | undefined = p.priceRange?.min;
  const productUrl = p.seo?.canonicalUrl || `${BASE_URL}/product/${slug}`;
  const ogImage: string =
    p.primaryImage?.url || p.images?.[0]?.url || `${BASE_URL}/og-default.jpg`;

  const allImages: string[] = (p.images ?? [])
    .map((img: any) => img.url)
    .filter(Boolean);

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description:
      p.seo?.metaDescription || p.shortDescription || p.description || undefined,
    image: allImages.length > 0 ? allImages : ogImage,
    url: productUrl,
    sku: p._id,
  };

  if (brandName) {
    schema.brand = { "@type": "Brand", name: brandName };
  }

  if (p.originCountry) {
    schema.countryOfOrigin = p.originCountry;
  }

  if (p.category?.name) {
    schema.category = p.category.name;
  }

  if (minPrice) {
    schema.offers = {
      "@type": "Offer",
      priceCurrency: "NGN",
      price: minPrice,
      availability:
        p.availability === "out_of_stock"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      url: productUrl,
      seller: { "@type": "Organization", name: "DrinksHarbour" },
    };
  }

  if (p.averageRating > 0 && p.reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.averageRating.toFixed(1),
      reviewCount: p.reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  // Additional product-specific attributes
  const additionalProps: { name: string; value: string }[] = [];
  if (p.abv) additionalProps.push({ name: "ABV", value: `${p.abv}%` });
  if (p.vintage) additionalProps.push({ name: "Vintage", value: String(p.vintage) });
  if (p.age) additionalProps.push({ name: "Age", value: String(p.age) });
  if (p.region) additionalProps.push({ name: "Region", value: p.region });
  if (additionalProps.length > 0) {
    schema.additionalProperty = additionalProps.map((prop) => ({
      "@type": "PropertyValue",
      name: prop.name,
      value: prop.value,
    }));
  }

  return schema;
}
