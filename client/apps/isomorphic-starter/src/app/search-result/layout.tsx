import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Search Results",
  description: "Search results for beverages on DrinksHarbour.",
  robots: { index: false, follow: true },
};

export default function SearchResultLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
