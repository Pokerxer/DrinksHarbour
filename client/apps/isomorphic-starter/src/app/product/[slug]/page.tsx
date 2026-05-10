import type { Metadata } from "next";
import ProductClient from "./ProductClient";

const API_URL  = process.env.NEXT_PUBLIC_API_URL  || "";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL  || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchProduct(slug: string) {
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

// ─── Static params (ISR) ──────────────────────────────────────────────────────

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_URL}/api/products/slugs`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const slugs: string[] = data?.data?.slugs ?? [];
    return slugs.map((slug) => ({ slug }));
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
  const p = await fetchProduct(slug);

  if (!p) {
    return {
      title: `Product Not Found | ${SITE_NAME}`,
      description: "This product could not be found on DrinksHarbour.",
      robots: { index: false, follow: false },
    };
  }

  const productUrl = p.canonicalUrl || `${BASE_URL}/product/${slug}`;
  const title      = buildTitle(p);
  const description = buildDescription(p);
  const keywords   = buildKeywords(p);
  const ogImage    = p.primaryImage?.url || p.images?.[0]?.url || `${BASE_URL}/og-default.jpg`;
  const allImages  = [
    ...(p.primaryImage?.url ? [{ url: p.primaryImage.url, width: 800, height: 800, alt: p.name }] : []),
    ...(p.images ?? [])
      .filter((img: any) => img.url && img.url !== p.primaryImage?.url)
      .slice(0, 3)
      .map((img: any) => ({ url: img.url, width: 800, height: 800, alt: p.name })),
  ];
  if (allImages.length === 0) allImages.push({ url: ogImage, width: 800, height: 800, alt: p.name });

  const minPrice: number | undefined = p.priceRange?.min;
  const isAvailable = p.availability !== "out_of_stock" && p.status !== "out_of_stock";

  return {
    title: `${title} | ${SITE_NAME}`,
    description,
    keywords,
    robots: { index: true, follow: true, "max-image-preview": "large" },
    alternates: { canonical: productUrl },

    openGraph: {
      type:        "website",
      url:         productUrl,
      siteName:    SITE_NAME,
      title:       `${title} | ${SITE_NAME}`,
      description,
      images:      allImages,
      locale:      "en_NG",
    },

    twitter: {
      card:        "summary_large_image",
      site:        "@DrinkHarbour",
      title:       `${title} | ${SITE_NAME}`,
      description,
      images:      [ogImage],
    },

    // Product-specific meta tags (Facebook / open-graph product namespace)
    other: {
      ...(minPrice
        ? {
            "product:price:amount":   String(Math.round(minPrice)),
            "product:price:currency": "NGN",
            "product:availability":   isAvailable ? "in stock" : "out of stock",
            "product:retailer_item_id": p.sku || p.barcode || p._id,
          }
        : {}),
      ...(p.brand?.name  ? { "product:brand":    p.brand.name }  : {}),
      ...(p.category?.name ? { "product:category": p.category.name } : {}),
    },
  };
}

// ─── Title builder ────────────────────────────────────────────────────────────

function buildTitle(p: any): string {
  if (p.metaTitle) return p.metaTitle;

  const parts: string[] = [p.name];

  // e.g. "Glenfiddich 40 Year Old – Buy Scotch Whisky Online"
  if (p.type) {
    const typeLabel = formatType(p.type);
    parts.push(`– Buy ${typeLabel} Online`);
  }

  return parts.join(" ").slice(0, 70);
}

// ─── Description builder ──────────────────────────────────────────────────────

function buildDescription(p: any): string {
  if (p.metaDescription)  return p.metaDescription;
  if (p.shortDescription) return p.shortDescription.slice(0, 160);

  const parts: string[] = [`Buy ${p.name}`];
  if (p.brand?.name)    parts.push(`by ${p.brand.name}`);
  if (p.vintage)        parts.push(`(${p.vintage} vintage)`);
  if (p.age)            parts.push(`– ${p.age}-year-old`);
  if (p.type)           parts.push(formatType(p.type));
  if (p.abv)            parts.push(`at ${p.abv}% ABV`);
  if (p.region)         parts.push(`from ${p.region}`);
  else if (p.originCountry) parts.push(`from ${p.originCountry}`);
  if (p.style)          parts.push(`– ${p.style}`);
  if (p.priceRange?.min)
    parts.push(`from ₦${Math.round(p.priceRange.min).toLocaleString()}`);
  parts.push("with fast delivery across Nigeria on DrinksHarbour.");

  return parts.join(" ").slice(0, 160);
}

// ─── Keywords builder ─────────────────────────────────────────────────────────

function buildKeywords(p: any): string[] {
  const typeLabel = p.type ? formatType(p.type) : "";
  const brand     = p.brand?.name ?? "";
  const country   = p.originCountry ?? "";

  return [
    // Stored keywords first
    ...(p.metaKeywords ?? []),
    // Core identifiers
    p.name,
    brand,
    typeLabel,
    // Purchase-intent terms
    brand && typeLabel ? `${brand} ${typeLabel}`     : null,
    brand             ? `buy ${brand} online`        : null,
    brand             ? `${brand} price Nigeria`     : null,
    typeLabel         ? `buy ${typeLabel} online`    : null,
    typeLabel         ? `${typeLabel} Nigeria`        : null,
    // Beverage attributes
    p.vintage ? `${p.vintage} vintage ${typeLabel}`  : null,
    p.age     ? `${p.age} year old ${typeLabel}`     : null,
    p.region  ? `${p.region} ${typeLabel}`           : null,
    country   ? `${country} ${typeLabel}`            : null,
    p.style   ? `${p.style} ${typeLabel}`            : null,
    // Store terms
    "buy alcohol online Nigeria",
    "online liquor store Nigeria",
    "drinks delivery Nigeria",
    SITE_NAME,
  ].filter(Boolean) as string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert snake_case type to readable label, e.g. "single_malt_scotch" → "Single Malt Scotch" */
function formatType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = await fetchProduct(slug);

  const schemas = p ? buildSchemas(p, slug) : [];

  return (
    <>
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <ProductClient slug={slug} />
    </>
  );
}

// ─── JSON-LD builders ─────────────────────────────────────────────────────────

function buildSchemas(p: any, slug: string): object[] {
  const schemas: object[] = [];

  // 1. Product schema
  schemas.push(buildProductSchema(p, slug));

  // 2. BreadcrumbList schema
  schemas.push(buildBreadcrumbSchema(p, slug));

  return schemas;
}

function buildProductSchema(p: any, slug: string): object {
  const productUrl = p.canonicalUrl || `${BASE_URL}/product/${slug}`;
  const brand      = p.brand?.name ?? "";
  const minPrice: number | undefined = p.priceRange?.min;
  const maxPrice: number | undefined = p.priceRange?.max;
  const isAvailable = p.availability !== "out_of_stock" && p.status !== "out_of_stock";

  const allImageUrls: string[] = (p.images ?? [])
    .map((img: any) => img.url)
    .filter(Boolean);
  if (p.primaryImage?.url && !allImageUrls.includes(p.primaryImage.url)) {
    allImageUrls.unshift(p.primaryImage.url);
  }

  const schema: Record<string, any> = {
    "@context": "https://schema.org",
    "@type":    "Product",
    name:        p.name,
    description: p.metaDescription || p.shortDescription || p.description || undefined,
    image:       allImageUrls.length > 0 ? allImageUrls : (p.primaryImage?.url || `${BASE_URL}/og-default.jpg`),
    url:         productUrl,
    // Prefer real identifiers over MongoDB _id
    ...(p.sku     ? { sku:    p.sku }     : { sku: p._id }),
    ...(p.gtin    ? { gtin:   p.gtin }    : {}),
    ...(p.barcode ? { gtin13: p.barcode } : {}),
    ...(p.upc     ? { gtin12: p.upc }     : {}),
    itemCondition: "https://schema.org/NewCondition",
  };

  if (brand) {
    schema.brand = { "@type": "Brand", name: brand };
  }
  if (p.category?.name) {
    schema.category = p.category.name;
  }
  if (p.originCountry) {
    schema.countryOfOrigin = p.originCountry;
  }
  if (p.color) {
    schema.color = p.color;
  }

  // Offers — AggregateOffer when price range, single Offer otherwise
  if (minPrice) {
    const availability = isAvailable
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

    const vendorCount = (p.availableAt ?? []).length;
    const hasRange = maxPrice && maxPrice > minPrice;

    if (hasRange && vendorCount > 1) {
      schema.offers = {
        "@type":        "AggregateOffer",
        lowPrice:       minPrice,
        highPrice:      maxPrice,
        priceCurrency:  "NGN",
        offerCount:     vendorCount,
        availability,
        url:            productUrl,
        seller:         { "@type": "Organization", name: SITE_NAME, url: BASE_URL },
      };
    } else {
      schema.offers = {
        "@type":         "Offer",
        price:           minPrice,
        priceCurrency:   "NGN",
        availability,
        url:             productUrl,
        itemCondition:   "https://schema.org/NewCondition",
        seller:          { "@type": "Organization", name: SITE_NAME, url: BASE_URL },
        shippingDetails: {
          "@type":             "OfferShippingDetails",
          shippingDestination: {
            "@type":          "DefinedRegion",
            addressCountry:   "NG",
          },
          deliveryTime: {
            "@type":       "ShippingDeliveryTime",
            businessDays:  { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday"] },
            handlingTime:  { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
            transitTime:   { "@type": "QuantitativeValue", minValue: 1, maxValue: 3, unitCode: "DAY" },
          },
        },
      };
    }
  }

  // Aggregate rating
  if (p.averageRating > 0 && p.reviewCount > 0) {
    schema.aggregateRating = {
      "@type":       "AggregateRating",
      ratingValue:   p.averageRating.toFixed(1),
      reviewCount:   p.reviewCount,
      bestRating:    "5",
      worstRating:   "1",
    };
  }

  // Beverage-specific additional properties
  const additionalProperty: { name: string; value: string }[] = [];
  if (p.abv)     additionalProperty.push({ name: "ABV",           value: `${p.abv}%` });
  if (p.vintage) additionalProperty.push({ name: "Vintage",       value: String(p.vintage) });
  if (p.age)     additionalProperty.push({ name: "Age Statement", value: `${p.age} Years` });
  if (p.region)  additionalProperty.push({ name: "Region",        value: p.region });
  if (p.style)   additionalProperty.push({ name: "Style",         value: p.style });
  if (p.type)    additionalProperty.push({ name: "Type",          value: formatType(p.type) });

  if (additionalProperty.length > 0) {
    schema.additionalProperty = additionalProperty.map((prop) => ({
      "@type": "PropertyValue",
      name:    prop.name,
      value:   prop.value,
    }));
  }

  return schema;
}

function buildBreadcrumbSchema(p: any, slug: string): object {
  const productUrl   = p.canonicalUrl || `${BASE_URL}/product/${slug}`;
  const categoryName = p.category?.name;
  const categorySlug = p.category?.slug;

  const items: { position: number; name: string; item: string }[] = [
    { position: 1, name: "Home", item: BASE_URL },
    { position: 2, name: "Shop", item: `${BASE_URL}/shop` },
  ];

  if (categoryName) {
    items.push({
      position: 3,
      name:     categoryName,
      item:     categorySlug
        ? `${BASE_URL}/shop?category=${categorySlug}`
        : `${BASE_URL}/shop`,
    });
  }

  items.push({
    position: categoryName ? 4 : 3,
    name:     p.name,
    item:     productUrl,
  });

  return {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: items.map(({ position, name, item }) => ({
      "@type":   "ListItem",
      position,
      name,
      item,
    })),
  };
}
