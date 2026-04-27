import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about DrinksHarbour — Nigeria's premier online beverage store. Our mission, story, and commitment to quality and fast delivery.",
  openGraph: {
    url: `${BASE_URL}/about`,
    title: "About DrinksHarbour",
    description:
      "Nigeria's premier online beverage store. Authentic products, fast delivery, and exceptional service.",
  },
  alternates: { canonical: `${BASE_URL}/about` },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
