import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Shipping Information",
  description:
    "Delivery areas, shipping rates, and estimated times for DrinksHarbour orders across Nigeria. Fast, reliable beverage delivery.",
  openGraph: {
    url: `${BASE_URL}/shipping-info`,
    title: "Shipping Information | DrinksHarbour",
    description: "Delivery areas, shipping rates, and estimated delivery times across Nigeria.",
  },
  alternates: { canonical: `${BASE_URL}/shipping-info` },
};

export default function ShippingInfoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
