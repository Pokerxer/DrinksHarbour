import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Sustainability",
  description:
    "DrinksHarbour's commitment to sustainable practices, responsible sourcing, and supporting local communities across Nigeria.",
  openGraph: {
    url: `${BASE_URL}/sustainability`,
    title: "Sustainability | DrinksHarbour",
    description:
      "Our commitment to sustainable practices, responsible sourcing, and supporting local communities.",
  },
  alternates: { canonical: `${BASE_URL}/sustainability` },
};

export default function SustainabilityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
