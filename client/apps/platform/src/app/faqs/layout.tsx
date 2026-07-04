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

const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I place an order?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Browse our shop, add items to your cart, then proceed to checkout. You'll need to create an account or log in, confirm your delivery address, and complete payment. You'll receive an order confirmation by email and SMS immediately.",
      },
    },
    {
      "@type": "Question",
      name: "Which areas do you deliver to?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We deliver to all 36 states and the FCT across Nigeria. Same-day delivery is available in Abuja and Lagos. Next-day delivery covers Port Harcourt, Kano, Ibadan, Enugu, and other major cities. Remote areas may take 2–4 business days.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods do you accept?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We accept debit and credit cards (Visa, Mastercard, Verve), bank transfers, USSD, and mobile money via Paystack. International cards are accepted via Stripe. All prices are displayed and charged in Nigerian Naira (₦).",
      },
    },
    {
      "@type": "Question",
      name: "How long does delivery take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Abuja & Lagos: same-day (orders before 12 noon) or next day. Other major cities: 1–2 business days. Remaining states: 2–4 business days. You will receive SMS and email updates at each stage of your delivery.",
      },
    },
    {
      "@type": "Question",
      name: "Are all products on DrinksHarbour authentic?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every vendor on our platform is verified and must provide documentation of supply chain authenticity before listing. We conduct regular audits and take immediate action against any vendor found selling counterfeit goods.",
      },
    },
    {
      "@type": "Question",
      name: "How do I become a vendor on DrinksHarbour?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Visit the Vendor Registration page, fill in your business details, upload the required documentation (CAC certificate, NAFDAC approvals where applicable), and submit for review. Approval typically takes 2–3 business days.",
      },
    },
  ],
};

export default function FaqsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }}
      />
      {children}
    </>
  );
}
