import type { Metadata } from "next";
import { normalizeDescription } from "@/lib/seoDescription";
import SeoContextBlock from '@/components/SEO/SeoContextBlock';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${name} — Shop on DrinksHarbour`,
    description: normalizeDescription('', `Browse drinks from ${name} on DrinksHarbour.`),
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
  const name = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <SeoContextBlock
        heading={`${name} drinks store on DrinksHarbour`}
        paragraphs={[`Browse drinks from ${name} on DrinksHarbour, including products available to buy online with delivery across Nigeria.`, `Compare available bottles and visit the store page to see current stock and prices.`]}
        links={[
          { href: `/vendors/${slug}`, label: `Visit ${name} store` },
          { href: '/shop', label: 'Browse all drinks online' },
          { href: '/shipping-info', label: 'Check delivery information' },
        ]}
      />
      {children}
    </>
  );
}
