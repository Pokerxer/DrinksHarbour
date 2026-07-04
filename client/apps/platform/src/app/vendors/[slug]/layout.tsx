import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${name} — Shop on DrinksHarbour`,
    description: `Browse premium beverages from ${name} on DrinksHarbour. Authentic products, fast delivery across Nigeria.`,
    alternates: { canonical: `${BASE_URL}/vendors/${slug}` },
  };
}

async function getBreadcrumbJsonLd(slug: string) {
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Vendors", item: `${BASE_URL}/vendors` },
      { "@type": "ListItem", position: 3, name, item: `${BASE_URL}/vendors/${slug}` },
    ],
  };
}

export default async function VendorStoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const breadcrumbJsonLd = await getBreadcrumbJsonLd(slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {children}
    </>
  );
}
