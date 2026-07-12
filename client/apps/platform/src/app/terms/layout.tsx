import type { Metadata } from "next";

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";
const LAST_UPDATED_ISO = "2026-07-12";

const description =
  "The Terms of Service for DrinksHarbour — how our multi-tenant beverage marketplace works, age (18+) and account rules, payments, delivery, refunds, Merchant terms, and your rights under Nigerian law.";

export const metadata: Metadata = {
  title: "Terms of Service",
  description,
  keywords: [
    "DrinksHarbour terms of service",
    "beverage marketplace terms Nigeria",
    "alcohol delivery terms Nigeria",
    "DrinksHarbour merchant terms",
    "terms and conditions Nigeria",
  ],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: { canonical: `${BASE_URL}/terms` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/terms`,
    siteName: SITE_NAME,
    title: "Terms of Service | DrinksHarbour",
    description,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    site: "@DrinkHarbour",
    title: "Terms of Service | DrinksHarbour",
    description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "DrinksHarbour Terms of Service",
  description,
  url: `${BASE_URL}/terms`,
  dateModified: LAST_UPDATED_ISO,
  inLanguage: "en-NG",
  publisher: {
    "@type": "Organization",
    name: "DrinksHarbour Technologies Ltd",
    url: BASE_URL,
  },
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "Terms of Service", item: `${BASE_URL}/terms` },
    ],
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
