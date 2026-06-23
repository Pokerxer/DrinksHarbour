import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "Careers — Join Our Team",
  description:
    "Explore career opportunities at DrinksHarbour. Join Nigeria's leading online beverage platform and help us deliver excellence.",
  openGraph: {
    url: `${BASE_URL}/careers`,
    title: "Careers | DrinksHarbour",
    description:
      "Join Nigeria's leading online beverage platform. View open roles and grow your career with DrinksHarbour.",
  },
  alternates: { canonical: `${BASE_URL}/careers` },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
