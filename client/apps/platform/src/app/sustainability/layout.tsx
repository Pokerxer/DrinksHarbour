import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Sustainability",
  description:
    "DrinksHarbour's commitment to sustainable practices, responsible sourcing, and supporting local communities across Nigeria.",
  openGraph: {
    url: `${BASE_URL}/sustainability`,
    title: "Sustainability | DrinksHarbour",
    description:
      "Our commitment to sustainable practices, responsible sourcing, and supporting local communities.",
  },
  alternates: { canonical: `${BASE_URL}/sustainability` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Sustainability",
  description: "DrinksHarbour's commitment to sustainable practices, responsible sourcing, and supporting local communities across Nigeria.",
  url: `${BASE_URL}/sustainability`,
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Sustainability", item: `${BASE_URL}/sustainability` },
    ],
  },
};

export default function SustainabilityLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
