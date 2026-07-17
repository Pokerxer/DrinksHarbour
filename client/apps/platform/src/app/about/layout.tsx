import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";

export const metadata: Metadata = {
  title: "About DrinksHarbour | Nigeria's Premier Beverage Marketplace",
  description:
    "Discover DrinksHarbour — Nigeria's trusted online marketplace for authentic wines, spirits, beers and non-alcoholic drinks. Shop 800+ products, enjoy same-day delivery in Abuja, and buy with confidence from verified vendors.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${BASE_URL}/about`,
    languages: { "en-NG": `${BASE_URL}/about` },
  },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/about`,
    siteName: SITE_NAME,
    title: "About DrinksHarbour | Nigeria's Premier Beverage Marketplace",
    description:
      "Discover DrinksHarbour — Nigeria's trusted online marketplace for authentic wines, spirits, beers and non-alcoholic drinks. Shop 800+ products, enjoy same-day delivery in Abuja.",
    images: [{ url: `${BASE_URL}/og-default.jpg`, width: 1200, height: 630, alt: "DrinksHarbour — Premium Beverage Marketplace" }],
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    site: "@DrinkHarbour",
    title: "About DrinksHarbour | Nigeria's Premier Beverage Marketplace",
    description:
      "Nigeria's trusted online marketplace for authentic wines, spirits, beers and non-alcoholic drinks.",
    images: [`${BASE_URL}/og-default.jpg`],
  },
};

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: BASE_URL,
  logo: `${BASE_URL}/logo.png`,
  description:
    "Nigeria's premier online beverage marketplace. Authentic wines, spirits, beers, and non-alcoholic drinks delivered across Abuja and beyond.",
  foundingDate: "2026",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Abuja",
    addressRegion: "FCT",
    addressCountry: "NG",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: ["English"],
  },
  sameAs: [
    "https://twitter.com/DrinkHarbour",
    "https://instagram.com/drinksharbour",
    "https://facebook.com/drinksharbour",
  ],
};

const BREADCRUMB_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
    { "@type": "ListItem", position: 2, name: "About Us", item: `${BASE_URL}/about` },
  ],
};

const WEBSITE_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: BASE_URL,
  potentialAction: [
    {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${BASE_URL}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  ],
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_SCHEMA) }} />
      {children}
    </>
  );
}
