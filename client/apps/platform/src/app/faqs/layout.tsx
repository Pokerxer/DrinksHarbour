import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://www.drinksharbour.com";

export const metadata: Metadata = {
  title: "FAQs — Frequently Asked Questions",
  description:
    "Find answers to common questions about ordering, delivery, payments, returns, and more on DrinksHarbour.",
  openGraph: {
    url: `${BASE_URL}/faqs`,
    title: "FAQs | DrinksHarbour",
    description: "Answers to common questions about ordering, delivery, payments, and returns.",
  },
  alternates: { canonical: `${BASE_URL}/faqs` },
};

export default function FaqsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
