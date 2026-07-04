import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Claim Your Gift Card",
  description:
    "Redeem your DrinksHarbour gift card. Enter the claim code to add funds to your account and start shopping premium beverages.",
  robots: { index: false, follow: false },
};

export default function GiftClaimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
