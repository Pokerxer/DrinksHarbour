import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Shop Premium Beverages",
  description:
    "Browse Nigeria's widest selection of wines, spirits, whiskeys, beers, and non-alcoholic drinks. Filter by brand, category, price, and more.",
  openGraph: {
    type: "website",
    url: `${BASE_URL}/shop`,
    title: "Shop Premium Beverages | DrinksHarbour",
    description:
      "Browse Nigeria's widest selection of wines, spirits, whiskeys, beers, and non-alcoholic drinks.",
    images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: "DrinksHarbour Shop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop Premium Beverages | DrinksHarbour",
    description:
      "Browse Nigeria's widest selection of wines, spirits, whiskeys, beers, and non-alcoholic drinks.",
    images: ["/og-default.jpg"],
  },
  alternates: { canonical: `${BASE_URL}/shop` },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
