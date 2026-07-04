import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Your Cart",
  robots: { index: false, follow: false },
  alternates: { canonical: `${BASE_URL}/cart` },
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
