import { DELIVERY_COPY, NATIONWIDE_DELIVERY_PROMISE } from '@/lib/deliveryCopy';
import { publicSiteOrigin } from '@/lib/publicSiteOrigin';
import { withSocialMetadata } from '@/lib/socialMetadata';
import type { Metadata } from "next";
import SeoContextBlock from '@/components/SEO/SeoContextBlock';
import { jsonLdHtml } from '@/lib/jsonld';

const BASE_URL = publicSiteOrigin();

export const metadata: Metadata = withSocialMetadata({
  title: "FAQs — Frequently Asked Questions",
  description:
    `Find answers about DrinksHarbour orders, payments and returns. ${NATIONWIDE_DELIVERY_PROMISE}`,
  openGraph: {
    url: `${BASE_URL}/faqs`,
    title: "FAQs | DrinksHarbour",
    description: "Answers to common questions about ordering, delivery, payments, and returns.",
  },
  alternates: { canonical: `${BASE_URL}/faqs` },
});

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
        text: DELIVERY_COPY.coverage,
      },
    },
    {
      "@type": "Question",
      name: "What payment methods do you accept?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We accept debit and credit cards (Visa, Mastercard, Verve), bank transfers, USSD, and mobile money via Korapay. International cards are accepted via Stripe. All prices are displayed and charged in Nigerian Naira (₦).",
      },
    },
    {
      "@type": "Question",
      name: "How long does delivery take?",
      acceptedAnswer: {
        "@type": "Answer",
        text: DELIVERY_COPY.timing,
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
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(FAQ_SCHEMA) }}
      />
      {children}
      <SeoContextBlock
        heading="Frequently asked questions about buying drinks online"
        paragraphs={[
          'Find answers about buying drinks online in Nigeria, including product authenticity, payments, age verification, delivery, returns and order tracking.',
          'Use the shop to browse wines, spirits, beer and non-alcoholic drinks, then review delivery details before checkout.',
        ]}
        links={[
          { href: '/shop', label: 'Shop drinks online' },
          { href: '/shipping-info', label: 'View nationwide delivery times and fees' },
          { href: '/returns', label: 'Read returns and refunds' },
        ]}
      />
    </>
  );
}
