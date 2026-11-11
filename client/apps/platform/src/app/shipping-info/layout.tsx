import { NATIONWIDE_DELIVERY_PROMISE } from '@/lib/deliveryCopy';
import { jsonLdHtml } from '@/lib/jsonld';
import { publicSiteOrigin } from '@/lib/publicSiteOrigin';
import { withSocialMetadata } from '@/lib/socialMetadata';
import type { Metadata } from "next";
import SeoContextBlock from '@/components/SEO/SeoContextBlock';

const BASE_URL = publicSiteOrigin();
const TITLE = "Drinks Delivery Across Nigeria";
const DESCRIPTION = `${NATIONWIDE_DELIVERY_PROMISE} See delivery zones, fees and eligibility.`;

export const metadata: Metadata = withSocialMetadata({
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    url: `${BASE_URL}/shipping-info`,
    title: `${TITLE} | DrinksHarbour`,
    description: DESCRIPTION,
  },
  alternates: { canonical: `${BASE_URL}/shipping-info` },
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: TITLE,
  description: DESCRIPTION,
  inLanguage: "en-NG",
  url: `${BASE_URL}/shipping-info`,
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      { "@type": "ListItem", position: 2, name: TITLE, item: `${BASE_URL}/shipping-info` },
    ],
  },
};

export default function ShippingInfoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      {children}
      <SeoContextBlock
        heading="Drinks delivery across Nigeria"
        paragraphs={[
          'DrinksHarbour delivers wine, whisky, champagne, spirits and non-alcoholic beverages from Abuja to customers across Nigeria.',
          'Review delivery zones, fees, order cutoffs and estimated times before you buy drinks online.',
        ]}
        links={[
          { href: '/shop', label: 'Buy drinks online' },
          { href: '/categories', label: 'Browse drinks categories' },
          { href: '/faqs', label: 'Read delivery FAQs' },
          { href: '/delivery/abuja', label: 'Delivery in Abuja and the FCT' },
          { href: '/delivery/lagos', label: 'Delivery to Lagos' },
        ]}
      />
    </>
  );
}
