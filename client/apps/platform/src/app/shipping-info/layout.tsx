import type { Metadata } from "next";
import SeoContextBlock from '@/components/SEO/SeoContextBlock';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Shipping Information",
  description:
    "Delivery areas, shipping rates, and estimated times for DrinksHarbour orders across Nigeria. Fast, reliable beverage delivery.",
  openGraph: {
    url: `${BASE_URL}/shipping-info`,
    title: "Shipping Information | DrinksHarbour",
    description: "Delivery areas, shipping rates, and estimated delivery times across Nigeria.",
  },
  alternates: { canonical: `${BASE_URL}/shipping-info` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Shipping Information",
  description: "Delivery areas, shipping rates, and estimated delivery times for DrinksHarbour orders across Nigeria.",
  url: `${BASE_URL}/shipping-info`,
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Shipping Information", item: `${BASE_URL}/shipping-info` },
    ],
  },
};

export default function ShippingInfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
      <SeoContextBlock
        heading="Drinks delivery across Nigeria"
        paragraphs={[
          'DrinksHarbour delivers wine, whisky, champagne, spirits and non-alcoholic beverages from Abuja to customers across Nigeria.',
          'Review delivery zones, fees, order cutoffs and estimated times before you buy drinks online.',
        ]}
        links={[
          { href: '/shop', label: 'Buy drinks online' },
          { href: '/categories', label: 'Browse drinks categories' },
          { href: '/faqs', label: 'Read delivery FAQs' },
        ]}
      />
    </>
  );
}
