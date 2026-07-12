import type { Metadata } from "next";

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";
const SITE_NAME = "DrinksHarbour";
const LAST_UPDATED_ISO = "2026-07-12";

const description =
  "How DrinksHarbour collects, uses, shares, and protects your personal data across our multi-tenant beverage marketplace. NDPA & NDPR compliant, with your rights, cookies, AI processing, and data-security practices explained.";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description,
  keywords: [
    "DrinksHarbour privacy policy",
    "NDPR privacy Nigeria",
    "NDPA data protection",
    "beverage marketplace privacy",
    "how DrinksHarbour uses my data",
    "data protection Nigeria",
  ],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: { canonical: `${BASE_URL}/privacy-policy` },
  openGraph: {
    type: "website",
    url: `${BASE_URL}/privacy-policy`,
    siteName: SITE_NAME,
    title: "Privacy Policy | DrinksHarbour",
    description,
    locale: "en_NG",
  },
  twitter: {
    card: "summary_large_image",
    site: "@DrinkHarbour",
    title: "Privacy Policy | DrinksHarbour",
    description,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "PrivacyPolicy",
  name: "DrinksHarbour Privacy Policy",
  description,
  url: `${BASE_URL}/privacy-policy`,
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
      { "@type": "ListItem", position: 2, name: "Privacy Policy", item: `${BASE_URL}/privacy-policy` },
    ],
  },
};

export default function PrivacyPolicyLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
