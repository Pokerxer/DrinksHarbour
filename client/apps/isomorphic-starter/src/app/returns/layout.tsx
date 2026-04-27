import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Returns & Refunds Policy",
  description:
    "Learn about DrinksHarbour's hassle-free returns and refunds policy. We stand behind every product we sell.",
  openGraph: {
    url: `${BASE_URL}/returns`,
    title: "Returns & Refunds | DrinksHarbour",
    description: "Our hassle-free returns and refunds policy. We stand behind every product we sell.",
  },
  alternates: { canonical: `${BASE_URL}/returns` },
};

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
