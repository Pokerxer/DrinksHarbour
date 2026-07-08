import * as Icon from 'react-icons/pi';

type IconComp = React.ComponentType<{ size?: number; className?: string }>;

export interface PlanTier {
  key: string;
  label: string;
  tagline: string;
  priceMonthly: number;
  skuLimit: string;
  staffLimit: string;
  commissionRate: string;
  features: string[];
  popular?: boolean;
  addOnsAllowed: boolean;
  accent: string;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  accentRing: string;
  glow: string;
}

export const PLAN_TIERS: PlanTier[] = [
  {
    key: 'free_trial',
    label: 'Free Trial',
    tagline: 'Test the waters, no commitment',
    priceMonthly: 0,
    skuLimit: '50 SKUs',
    staffLimit: '1 staff',
    commissionRate: '13%',
    features: ['Inventory management', 'Order processing', 'Single-outlet POS', 'Branded storefront'],
    addOnsAllowed: false,
    accent: 'gray',
    accentBg: 'bg-gray-100',
    accentText: 'text-gray-600',
    accentBorder: 'border-gray-200',
    accentRing: 'ring-gray-100',
    glow: 'hover:shadow-gray-200/50',
  },
  {
    key: 'starter',
    label: 'Starter',
    tagline: 'For small shops getting online',
    priceMonthly: 15000,
    skuLimit: '100 SKUs',
    staffLimit: '1 staff',
    commissionRate: '13%',
    features: ['Everything in Free Trial', 'Sales invoicing', 'Order tracking', 'Basic analytics'],
    addOnsAllowed: false,
    accent: 'blue',
    accentBg: 'bg-blue-50',
    accentText: 'text-blue-700',
    accentBorder: 'border-blue-200',
    accentRing: 'ring-blue-100',
    glow: 'hover:shadow-blue-200/50',
  },
  {
    key: 'growth',
    label: 'Growth',
    tagline: 'For expanding merchants',
    priceMonthly: 35000,
    skuLimit: '500 SKUs',
    staffLimit: '3 staff',
    commissionRate: '11%',
    features: ['Everything in Starter', 'Basic CRM', 'Purchase orders', 'Vendor management'],
    addOnsAllowed: false,
    accent: 'emerald',
    accentBg: 'bg-emerald-50',
    accentText: 'text-emerald-700',
    accentBorder: 'border-emerald-200',
    accentRing: 'ring-emerald-100',
    glow: 'hover:shadow-emerald-200/50',
  },
  {
    key: 'pro',
    label: 'Pro',
    tagline: 'For multi-outlet operations',
    priceMonthly: 65000,
    skuLimit: '2,000 SKUs',
    staffLimit: '10 staff',
    commissionRate: '10%',
    features: ['Multi-outlet POS', 'Multi-location', 'Advanced reports', 'API access', 'Add-ons enabled'],
    popular: true,
    addOnsAllowed: true,
    accent: 'red',
    accentBg: 'bg-red-50',
    accentText: 'text-red-700',
    accentBorder: 'border-red-300',
    accentRing: 'ring-red-200',
    glow: 'hover:shadow-red-200/60',
  },
  {
    key: 'enterprise',
    label: 'Enterprise',
    tagline: 'For large distributors & brands',
    priceMonthly: 85000,
    skuLimit: 'Unlimited',
    staffLimit: 'Unlimited',
    commissionRate: '9%',
    features: ['Advanced CRM', 'Custom integrations', 'Priority support', 'Dedicated manager'],
    addOnsAllowed: true,
    accent: 'purple',
    accentBg: 'bg-purple-50',
    accentText: 'text-purple-700',
    accentBorder: 'border-purple-200',
    accentRing: 'ring-purple-100',
    glow: 'hover:shadow-purple-200/50',
  },
  {
    key: 'venue',
    label: 'Venue',
    tagline: 'For bars, lounges & clubs',
    priceMonthly: 150000,
    skuLimit: 'Unlimited',
    staffLimit: 'Unlimited',
    commissionRate: '9%',
    features: ['Real-time POS', 'Table management', 'Guest CRM', 'Event booking', 'Bar inventory'],
    addOnsAllowed: true,
    accent: 'amber',
    accentBg: 'bg-amber-50',
    accentText: 'text-amber-700',
    accentBorder: 'border-amber-200',
    accentRing: 'ring-amber-100',
    glow: 'hover:shadow-amber-200/50',
  },
];

export const ADD_ON_PRICES = {
  extra_shop: 12000,
  extra_warehouse: 20000,
};

export interface Benefit {
  icon: IconComp;
  title: string;
  body: string;
  color: string;
}

export const BENEFITS: Benefit[] = [
  {
    icon: Icon.PiStorefrontBold,
    title: 'Digital Storefront',
    body: 'Get a branded storefront on DrinksHarbour with your own URL, logo, and product catalogue — no web development needed.',
    color: 'bg-red-50 text-red-700',
  },
  {
    icon: Icon.PiUsersBold,
    title: 'Built-in Audience',
    body: 'Reach a growing community of verified buyers across the FCT and beyond. We handle marketing — you focus on stock.',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    icon: Icon.PiCreditCardBold,
    title: 'Secure Payments',
    body: 'Paystack and Stripe integrations with instant payment confirmation. Get paid in Naira, on time, every time.',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: Icon.PiChartLineBold,
    title: 'ERM Tools',
    body: 'Inventory, orders, invoicing, CRM, and analytics — everything you need to run your beverage business in one dashboard.',
    color: 'bg-amber-50 text-amber-700',
  },
];

export interface Step {
  num: string;
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    num: '01',
    title: 'Submit Your Application',
    body: 'Fill out the form below with your business details and preferred plan. It takes less than five minutes.',
  },
  {
    num: '02',
    title: 'Get Approved',
    body: 'Our team reviews your application within 48 hours. We verify your business and set up your storefront.',
  },
  {
    num: '03',
    title: 'Start Selling',
    body: 'Add your products, set your prices, and start receiving orders. Your storefront goes live immediately.',
  },
];

export const NIGERIAN_STATES = [
  'Abuja (FCT)', 'Lagos', 'Rivers', 'Kano', 'Oyo', 'Kaduna', 'Enugu', 'Anambra',
  'Delta', 'Edo', 'Akwa Ibom', 'Cross River', 'Imo', 'Ogun', 'Ondo', 'Ekiti',
  'Osun', 'Kwara', 'Benue', 'Plateau', 'Bauchi', 'Borno', 'Sokoto', 'Jigawa',
  'Kebbi', 'Niger', 'Kogi', 'Nasarawa', 'Taraba', 'Adamawa', 'Gombe', 'Yobe',
  'Zamfara', 'Katsina', 'Bayelsa', 'Abia',
];

export const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How long does the vendor approval process take?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Our team reviews every application within 48 hours. Once approved, your storefront goes live immediately and you can start adding products.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do I need to pay to start selling?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. You can start with our Free Trial plan — 50 SKUs and 1 staff member at no cost. When you are ready to scale, upgrade to a paid plan starting at ₦15,000 per month.',
      },
    },
    {
      '@type': 'Question',
      name: 'What commission does DrinksHarbour charge?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Commission ranges from 9% to 13% depending on your plan. Free Trial and Starter plans pay 13%, Growth pays 11%, Pro pays 10%, and Enterprise and Venue plans pay 9% per sale.',
      },
    },
    {
      '@type': 'Question',
      name: 'What types of businesses can sell on DrinksHarbour?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Wine merchants, spirit importers, beverage brands, liquor stores, bars, lounges, restaurants, hotels, and distributors are all welcome. If you sell beverages in Nigeria, we have a plan for you.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I get paid for my sales?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'All payments are processed through Paystack or Stripe in Nigerian Naira. Your earnings are settled to your bank account on a rolling basis, typically within 2 to 5 business days.',
      },
    },
  ],
};

export interface VendorStat {
  value: string;
  label: string;
  icon: IconComp;
}

export const VENDOR_STATS: VendorStat[] = [
  { value: '800+', label: 'Products Listed', icon: Icon.PiWineBold },
  { value: '60+', label: 'Brands Onboard', icon: Icon.PiStorefront },
  { value: '1,500+', label: 'Active Buyers', icon: Icon.PiUsers },
  { value: '48hrs', label: 'Approval Time', icon: Icon.PiClockBold },
];

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  location: string;
  rating: number;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'Joining DrinksHarbour was the best decision for our wine business. We went from a small shop in Wuse to receiving orders from across the FCT within weeks.',
    author: 'Chioma Okafor',
    role: 'Owner',
    location: 'Wine Valley, Abuja',
    rating: 5,
  },
  {
    quote: 'The ERM tools save us hours every week. Inventory, orders, invoicing — all in one place. The dashboard is clean and the support team actually responds.',
    author: 'Tunde Bakare',
    role: 'Managing Director',
    location: 'Lagos Spirits Co.',
    rating: 5,
  },
  {
    quote: 'As a craft gin producer, getting discovered was our biggest challenge. DrinksHarbour gave us a storefront and a customer base we could never reach alone.',
    author: 'Ngozi Eze',
    role: 'Founder',
    location: 'Abuja Craft Distillery',
    rating: 5,
  },
];

export interface TrustBadge {
  icon: IconComp;
  label: string;
  description: string;
}

export const TRUST_BADGES: TrustBadge[] = [
  {
    icon: Icon.PiShieldCheckBold,
    label: 'Verified Vendor Program',
    description: 'Every vendor is vetted before listing. Buyers trust the DrinksHarbour seal.',
  },
  {
    icon: Icon.PiLockBold,
    label: 'Secure Payments',
    description: 'Paystack and Stripe power every transaction with 3-D Secure authentication.',
  },
  {
    icon: Icon.PiHeadsetBold,
    label: 'Dedicated Support',
    description: 'AI chatbot plus human agents on WhatsApp, email, and live chat — 24/7.',
  },
  {
    icon: Icon.PiTruckBold,
    label: 'Logistics Network',
    description: 'Trusted delivery partners ensure safe, on-time fulfilment to your customers.',
  },
];

export interface FeatureComparison {
  feature: string;
  free_trial: string | boolean;
  starter: string | boolean;
  growth: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
  venue: string | boolean;
}

export const FEATURE_COMPARISON: FeatureComparison[] = [
  { feature: 'Branded storefront', free_trial: true, starter: true, growth: true, pro: true, enterprise: true, venue: true },
  { feature: 'Inventory management', free_trial: true, starter: true, growth: true, pro: true, enterprise: true, venue: true },
  { feature: 'Order processing', free_trial: true, starter: true, growth: true, pro: true, enterprise: true, venue: true },
  { feature: 'POS (single outlet)', free_trial: true, starter: true, growth: true, pro: false, enterprise: false, venue: false },
  { feature: 'POS (multi outlet)', free_trial: false, starter: false, growth: false, pro: true, enterprise: true, venue: true },
  { feature: 'Sales invoicing', free_trial: false, starter: true, growth: true, pro: true, enterprise: true, venue: true },
  { feature: 'Basic CRM', free_trial: false, starter: false, growth: true, pro: true, enterprise: false, venue: false },
  { feature: 'Advanced CRM', free_trial: false, starter: false, growth: false, pro: false, enterprise: true, venue: true },
  { feature: 'Purchase orders', free_trial: false, starter: false, growth: true, pro: true, enterprise: true, venue: true },
  { feature: 'Multi-location', free_trial: false, starter: false, growth: false, pro: true, enterprise: true, venue: true },
  { feature: 'Advanced reports', free_trial: false, starter: false, growth: false, pro: true, enterprise: true, venue: true },
  { feature: 'API access', free_trial: false, starter: false, growth: false, pro: true, enterprise: true, venue: true },
  { feature: 'Table management', free_trial: false, starter: false, growth: false, pro: false, enterprise: false, venue: true },
  { feature: 'Event booking', free_trial: false, starter: false, growth: false, pro: false, enterprise: false, venue: true },
  { feature: 'Bar inventory (real-time)', free_trial: false, starter: false, growth: false, pro: false, enterprise: false, venue: true },
];

export const ID_TYPES = [
  'NIN (National ID)',
  "Driver's License",
  'International Passport',
  "Voter's Card",
];

export const NIGERIAN_BANKS = [
  'Access Bank', 'Access Bank (Diamond)', 'Fidelity Bank', 'First Bank of Nigeria',
  'First City Monument Bank (FCMB)', 'Guaranty Trust Bank (GTBank)', 'Heritage Bank',
  'Keystone Bank', 'Polaris Bank', 'Providus Bank', 'Stanbic IBTC Bank',
  'Standard Chartered Bank', 'Sterling Bank', 'SunTrust Bank', 'Union Bank of Nigeria',
  'United Bank for Africa (UBA)', 'Unity Bank', 'Wema Bank', 'Zenith Bank',
  'Opay', 'Kuda Microfinance Bank', 'Palmpay', 'Moniepoint MFB', 'Other',
];

export interface BusinessType {
  label: string;
  icon: IconComp;
  description: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  { label: 'Wine Merchant', icon: Icon.PiWineBold, description: 'Sell wines online' },
  { label: 'Spirit Importer', icon: Icon.PiFlaskBold, description: 'Import & distribute spirits' },
  { label: 'Beverage Brand', icon: Icon.PiTagBold, description: 'Own a beverage brand' },
  { label: 'Liquor Store', icon: Icon.PiStorefrontBold, description: 'Physical retail store' },
  { label: 'Bar / Lounge', icon: Icon.PiBeerSteinBold, description: 'Serve drinks on-site' },
  { label: 'Restaurant', icon: Icon.PiForkKnifeBold, description: 'Dine-in with bar' },
  { label: 'Hotel', icon: Icon.PiBedBold, description: 'Hospitality with minibar' },
  { label: 'Distributor', icon: Icon.PiTruckBold, description: 'Wholesale distribution' },
  { label: 'Other', icon: Icon.PiDotsThreeBold, description: 'Something else' },
];