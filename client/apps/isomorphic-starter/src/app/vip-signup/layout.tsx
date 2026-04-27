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

export default function VipSignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
