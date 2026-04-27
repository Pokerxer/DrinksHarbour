import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Blog — Drinks & Lifestyle",
  description:
    "Explore DrinksHarbour's blog for drink guides, cocktail recipes, tasting notes, and lifestyle articles about wines, spirits, and beers.",
  openGraph: {
    url: `${BASE_URL}/blog`,
    title: "Blog — Drinks & Lifestyle | DrinksHarbour",
    description:
      "Drink guides, cocktail recipes, tasting notes, and lifestyle articles from Nigeria's premier beverage store.",
  },
  alternates: { canonical: `${BASE_URL}/blog` },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
