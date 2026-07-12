import type { Metadata } from "next";

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";
const LAST_UPDATED_ISO = "2026-07-12";

const description =
  "How DrinksHarbour uses cookies and similar technologies — essential, preference, analytics, and marketing cookies — and how you can manage your consent. NDPA & NDPR aligned.";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description,
  keywords: [
    "DrinksHarbour cookie policy",
    "cookies Nigeria",
    "cookie consent NDPR",
    "manage cookies DrinksHarbour",
    "tracking technologies",
  ],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: { canonical: `${BASE_URL}/cookie-policy` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/cookie-policy`,
    siteName: SITE_NAME,
    title: "Cookie Policy | DrinksHarbour",
    description,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    site: "@DrinkHarbour",
    title: "Cookie Policy | DrinksHarbour",
    description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "DrinksHarbour Cookie Policy",
  description,
  url: `${BASE_URL}/cookie-policy`,
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
      { "@type": "ListItem", position: 2, name: "Cookie Policy", item: `${BASE_URL}/cookie-policy` },
    ],
  },
};

export default function CookiePolicyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
