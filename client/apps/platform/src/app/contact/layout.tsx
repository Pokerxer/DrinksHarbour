import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with DrinksHarbour. Reach our support team for questions about orders, delivery, products, and more.",
  openGraph: {
    url: `${BASE_URL}/contact`,
    title: "Contact DrinksHarbour",
    description: "Reach our support team for questions about orders, delivery, and products.",
  },
  alternates: { canonical: `${BASE_URL}/contact` },
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "Contact Us", item: `${BASE_URL}/contact` },
  ],
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }} />
      {children}
    </>
  );
}
