import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Learn how DrinksHarbour collects, uses, and protects your personal information. Your privacy matters to us.",
  openGraph: {
    url: `${BASE_URL}/privacy-policy`,
    title: "Privacy Policy | DrinksHarbour",
    description: "How DrinksHarbour collects, uses, and protects your personal data.",
  },
  alternates: { canonical: `${BASE_URL}/privacy-policy` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Privacy Policy",
  description: "How DrinksHarbour collects, uses, and protects your personal information.",
  url: `${BASE_URL}/privacy-policy`,
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
