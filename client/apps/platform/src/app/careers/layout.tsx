import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Careers — Join Our Team",
  description:
    "Explore career opportunities at DrinksHarbour. Join Nigeria's leading online beverage platform and help us deliver excellence.",
  openGraph: {
    url: `${BASE_URL}/careers`,
    title: "Careers | DrinksHarbour",
    description:
      "Join Nigeria's leading online beverage platform. View open roles and grow your career with DrinksHarbour.",
  },
  alternates: { canonical: `${BASE_URL}/careers` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Careers at DrinksHarbour",
  description: "Career opportunities at DrinksHarbour, Nigeria's leading online beverage platform.",
  url: `${BASE_URL}/careers`,
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Careers", item: `${BASE_URL}/careers` },
    ],
  },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
