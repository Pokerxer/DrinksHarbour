import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "VIP Membership — Exclusive Deals & Early Access",
  description:
    "Join DrinksHarbour VIP for exclusive discounts, early access to new arrivals, and members-only offers on premium beverages.",
  openGraph: {
    url: `${BASE_URL}/vip-signup`,
    title: "VIP Membership | DrinksHarbour",
    description: "Exclusive discounts, early access, and members-only offers on premium beverages.",
  },
  alternates: { canonical: `${BASE_URL}/vip-signup` },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "VIP Membership — DrinksHarbour",
  description: "Join DrinksHarbour VIP for exclusive discounts, early access, and members-only offers on premium beverages.",
  url: `${BASE_URL}/vip-signup`,
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: "VIP Membership", item: `${BASE_URL}/vip-signup` },
    ],
  },
};

export default function VipSignupLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {children}
    </>
  );
}
