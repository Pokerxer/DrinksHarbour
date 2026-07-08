import * as Icon from 'react-icons/pi';

type IconComp = React.ComponentType<{ size?: number; className?: string }>;

export interface StatData { value: string; label: string; icon: IconComp }
export interface ValueData { icon: IconComp; title: string; body: string; color: string }
export interface MilestoneData { year: string; title: string; body: string }

export const STATS: StatData[] = [
  { value: '800+',  label: 'Products', icon: Icon.PiWineBold },
  { value: '60+',   label: 'Brands',   icon: Icon.PiStorefront },
  { value: '1,500+', label: 'Customers', icon: Icon.PiUsers },
  { value: '5+',    label: 'States Reached', icon: Icon.PiMapPin },
];

export const VALUES: ValueData[] = [
  {
    icon: Icon.PiSealCheckBold,
    title: 'Authenticity First',
    body: 'Every product on DrinksHarbour is sourced from verified distributors and brand-authorised vendors. We guarantee genuine products — no counterfeits, ever.',
    color: 'bg-red-50 text-red-700',
  },
  {
    icon: Icon.PiTruckBold,
    title: 'Fast, Reliable Delivery',
    body: 'Same-day delivery in Abuja and Lagos, next-day to major cities. We partner with trusted logistics providers to get your order to you safely and on time.',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    icon: Icon.PiHandshakeBold,
    title: 'Vendor Partnership',
    body: 'We empower local wine merchants, importers, and distributors by giving them a digital storefront and access to a growing community of customers across the FCT and beyond.',
    color: 'bg-amber-50 text-amber-700',
  },
  {
    icon: Icon.PiShieldCheckBold,
    title: 'Secure & Transparent',
    body: 'All transactions are protected with bank-grade encryption. Prices are clear, fees are disclosed upfront, and your data is never sold.',
    color: 'bg-emerald-50 text-emerald-700',
  },
];

export const MILESTONES: MilestoneData[] = [
  { year: 'Q1 2026', title: 'Founded', body: 'DrinksHarbour launched in Abuja with a curated catalogue of premium spirits and wines, serving the FCT directly.' },
  { year: 'Q2 2026', title: 'Marketplace Launch', body: 'Opened the platform to third-party vendors — local wine merchants, importers, and craft producers — giving each a digital storefront.' },
  { year: 'Q3 2026', title: 'Growing Reach', body: 'Delivery expanded beyond Abuja to neighbouring states. A growing community of active customers and brands now on the platform.' },
  { year: 'Now',    title: 'Growing & Innovating', body: 'Rolling out AI-powered product discovery, real-time inventory sync, and new features to serve customers and vendors across Nigeria.' },
];

export const WHY_ITEMS: Omit<ValueData, 'color'>[] = [
  { icon: Icon.PiCurrencyNgn,  title: 'Naira Pricing',      body: 'All prices in ₦ — no hidden FX charges or surprises at checkout.' },
  { icon: Icon.PiHeadset,      title: '24 / 7 Support',     body: 'AI chatbot + human agents available via WhatsApp, email, and live chat.' },
  { icon: Icon.PiStar,         title: 'Curated Selection',  body: 'Hand-picked catalogue covering wines, whiskies, gins, beers, and mocktails.' },
  { icon: Icon.PiPercent,      title: 'Best Prices',        body: 'We monitor the market so our prices stay competitive — and flash sales run weekly.' },
  { icon: Icon.PiLock,         title: 'Safe Payments',      body: 'Paystack and Stripe integrations with 3-D Secure and instant payment confirmation.' },
];

export const FAQ_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Are products on DrinksHarbour authentic?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Every product on DrinksHarbour is sourced from verified distributors and brand-authorised vendors. We guarantee genuine products with no counterfeits.",
      },
    },
    {
      "@type": "Question",
      name: "How fast is delivery in Nigeria?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We offer same-day delivery in Abuja and delivery to neighbouring states. We partner with trusted logistics providers for safe and timely delivery, with new areas added regularly.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods do you accept?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We accept payments via Paystack and Stripe with 3-D Secure authentication. All prices are in Nigerian Naira with no hidden fees or foreign exchange charges.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to create an account to place an order?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, you need a free DrinksHarbour account to place orders. Registration takes less than a minute and lets you track orders, save your favourite products, and access exclusive deals.",
      },
    },
    {
      "@type": "Question",
      name: "What is your return and refund policy?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We accept returns on unopened, undamaged products within seven days of delivery. Once the item is received and inspected, we process the refund to your original payment method within five business days.",
      },
    },
  ],
};

export const LAST_UPDATED = '2026-06-28';
