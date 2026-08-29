import * as Icon from 'react-icons/pi';

type IconComp = React.ComponentType<{ size?: number; className?: string }>;

// ─── Module Definitions ───────────────────────────────────────────────────────

export interface ErmModule {
  id: string;
  name: string;
  tagline: string;
  description: string;
  bullets: { text: string; benefit: string }[];
  screenshot: string;
  adminRoute: string;
  icon: IconComp;
}

export const ERM_MODULES: ErmModule[] = [
  {
    id: 'analytics',
    name: 'Store Analytics',
    tagline: 'Know exactly where your money comes from',
    description:
      'Stop guessing. See real-time revenue, best-sellers, and customer trends on a single dashboard — so you can stock smarter, price better, and grow faster.',
    bullets: [
      { text: 'Revenue dashboards', benefit: 'See daily, weekly, and monthly sales at a glance' },
      { text: 'Top-selling products', benefit: 'Know what moves and what sits on the shelf' },
      { text: 'Customer insights', benefit: 'Understand who buys, when, and how often' },
      { text: 'Custom date reports', benefit: 'Drill into any period for exact numbers' },
    ],
    screenshot: '/erm/screenshots/analytics.png',
    adminRoute: '/store-analytics',
    icon: Icon.PiChartLine,
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    tagline: 'Never run out of what sells',
    description:
      'Track every bottle across every location in real time. Get alerts before stock runs low, manage movements between warehouses, and keep your best sellers always available.',
    bullets: [
      { text: 'Real-time stock levels', benefit: 'Know exactly what you have, where, right now' },
      { text: 'Low-stock alerts', benefit: 'Get notified before you run out of best sellers' },
      { text: 'Stock movements', benefit: 'Track every bottle from receiving to shelf' },
      { text: 'Expiry tracking', benefit: 'Pull aging stock before it expires' },
    ],
    screenshot: '/erm/screenshots/inventory.png',
    adminRoute: '/inventory',
    icon: Icon.PiPackage,
  },
  {
    id: 'pos',
    name: 'Point of Sale',
    tagline: 'Checkout in seconds, not minutes',
    description:
      'A fast, intuitive POS built for busy bars and shops. Process cash, card, and mobile payments in seconds. Your staff will love it — and so will your customers.',
    bullets: [
      { text: 'Product grid + barcode scan', benefit: 'Find any product in under two seconds' },
      { text: 'Multi-payment checkout', benefit: 'Accept cash, card, transfer, or mobile' },
      { text: 'Digital & printed receipts', benefit: 'Customers get proof of purchase their way' },
      { text: 'Cashier sessions', benefit: 'End-of-day reconciliation that actually balances' },
    ],
    screenshot: '/erm/screenshots/pos.png',
    adminRoute: '/point-of-sale',
    icon: Icon.PiCreditCard,
  },
  {
    id: 'sales',
    name: 'Orders & Sales',
    tagline: 'From quote to cash, tracked every step',
    description:
      'Manage the full order lifecycle — quotations, confirmations, fulfillment, and returns. Never lose track of an order or miss a follow-up again.',
    bullets: [
      { text: 'Order tracking', benefit: 'See every order\'s status in real time' },
      { text: 'Quotation workflows', benefit: 'Send professional quotes that convert to orders' },
      { text: 'Returns & exchanges', benefit: 'Handle returns without losing the customer' },
      { text: 'Sales analytics', benefit: 'Spot trends and seasonal patterns in your data' },
    ],
    screenshot: '/erm/screenshots/sales.png',
    adminRoute: '/sales/orders',
    icon: Icon.PiShoppingCart,
  },
  {
    id: 'invoice',
    name: 'Invoicing & Payments',
    tagline: 'Get paid faster, reconcile easier',
    description:
      'Create professional invoices in seconds. Automate payment reminders, track who owes you, and reconcile payments without the spreadsheet headaches.',
    bullets: [
      { text: 'One-click invoicing', benefit: 'Generate branded invoices from any order' },
      { text: 'PDF & email delivery', benefit: 'Send invoices directly to customers' },
      { text: 'Payment tracking', benefit: 'See who has paid and who owes at a glance' },
      { text: 'Automatic reminders', benefit: 'Follow up on unpaid invoices without the awkwardness' },
    ],
    screenshot: '/erm/screenshots/invoice.png',
    adminRoute: '/invoice',
    icon: Icon.PiFileText,
  },
  {
    id: 'purchases',
    name: 'Purchasing & Reordering',
    tagline: 'Restock before you run out',
    description:
      'Create purchase orders, manage vendor relationships, and track incoming stock — all from one screen. Never miss a reorder window again.',
    bullets: [
      { text: 'Purchase orders', benefit: 'Create and track POs to your vendors' },
      { text: 'Vendor management', benefit: 'Compare prices and track vendor performance' },
      { text: 'Goods receipt', benefit: 'Confirm deliveries match your orders exactly' },
      { text: 'Reorder suggestions', benefit: 'AI-powered alerts when stock hits reorder point' },
    ],
    screenshot: '/erm/screenshots/purchases.png',
    adminRoute: '/purchases',
    icon: Icon.PiTruck,
  },
  {
    id: 'warehouses',
    name: 'Warehouses & Locations',
    tagline: 'One dashboard, every location',
    description:
      'Manage stock across multiple shops and warehouses from a single screen. Transfer inventory, track capacity, and run location-level reports — no matter how many outlets you have.',
    bullets: [
      { text: 'Multi-location overview', benefit: 'See all your locations on one screen' },
      { text: 'Inter-warehouse transfers', benefit: 'Move stock between locations with full traceability' },
      { text: 'Capacity tracking', benefit: 'Know when a warehouse is running out of space' },
      { text: 'Location analytics', benefit: 'Compare performance across your outlets' },
    ],
    screenshot: '/erm/screenshots/warehouses.png',
    adminRoute: '/warehouses',
    icon: Icon.PiHouseLine,
  },
  {
    id: 'contacts',
    name: 'Customers & CRM',
    tagline: 'Know your customers by name, not by number',
    description:
      'Build a rich customer directory with purchase history, preferences, and notes. The CRM that helps you turn one-time buyers into loyal regulars.',
    bullets: [
      { text: 'Customer profiles', benefit: 'See every customer\'s full history in one view' },
      { text: 'Purchase history', benefit: 'Know what each customer buys and how often' },
      { text: 'Tags & segments', benefit: 'Group customers for targeted promotions' },
      { text: 'Notes & communication', benefit: 'Never forget a conversation or preference' },
    ],
    screenshot: '/erm/screenshots/contacts.png',
    adminRoute: '/contacts',
    icon: Icon.PiUsers,
  },
  {
    id: 'employees',
    name: 'Staff Management',
    tagline: 'The right access for the right people',
    description:
      'Manage your team with role-based access, shift scheduling, and attendance tracking. Every staff member sees exactly what they need — nothing more, nothing less.',
    bullets: [
      { text: 'Role-based access', benefit: 'Cashiers, managers, owners — everyone gets the right view' },
      { text: 'Shift scheduling', benefit: 'Build rosters and track attendance in minutes' },
      { text: 'Time-off management', benefit: 'Approve leave requests without the paper trail' },
      { text: 'Employee profiles', benefit: 'Keep documents, contacts, and contracts in one place' },
    ],
    screenshot: '/erm/screenshots/employees.png',
    adminRoute: '/employees',
    icon: Icon.PiIdentificationBadge,
  },
  {
    id: 'ecommerce',
    name: 'Ecommerce Storefront',
    tagline: 'Your store, online, today',
    description:
      'Set up your branded online store on DrinksHarbour in minutes. Manage your catalogue, pricing, and promotions — no web developer needed.',
    bullets: [
      { text: 'Branded storefront', benefit: 'Your logo, your colours, your domain' },
      { text: 'Catalogue management', benefit: 'Add, edit, and organise products with ease' },
      { text: 'Pricing & promotions', benefit: 'Run sales and set bulk pricing rules' },
      { text: 'Online order management', benefit: 'Process and fulfill orders from one screen' },
    ],
    screenshot: '/erm/screenshots/ecommerce.png',
    adminRoute: '/ecommerce',
    icon: Icon.PiStorefront,
  },
];

// ─── Stats / Social Proof ─────────────────────────────────────────────────────

export interface Stat {
  value: string;
  label: string;
  icon: IconComp;
}

export const ERM_STATS = ({
  vendorCount,
  productCount,
}: {
  vendorCount: number;
  productCount: number;
}): Stat[] => [
  {
    value: productCount >= 1000 ? `${(productCount / 1000).toFixed(1)}K` : `${productCount}+`,
    label: 'Products on the platform',
    icon: Icon.PiPackageBold,
  },
  {
    value: vendorCount >= 1 ? `${vendorCount}` : '—',
    label: 'Active vendors',
    icon: Icon.PiStorefrontBold,
  },
  { value: '10', label: 'Integrated ERM modules', icon: Icon.PiGridFourBold },
  { value: '99.9%', label: 'Platform uptime', icon: Icon.PiShieldCheckBold },
];

// ─── Testimonials ─────────────────────────────────────────────────────────────

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  location: string;
  rating: number;
}

export const TESTIMONIALS: Testimonial[] = [
  {
    quote: 'Before DrinksHarbour, I tracked stock in a notebook. Now I see exactly what I have across two locations, and the POS handles checkout in seconds. My staff picked it up in a day.',
    author: 'Chioma Okafor',
    role: 'Owner',
    location: 'Wine Valley, Abuja',
    rating: 5,
  },
  {
    quote: 'The invoicing alone saved us hours every week. Before, I was manually writing receipts in Excel. Now I click one button and the customer gets a professional PDF by email.',
    author: 'Tunde Bakare',
    role: 'Managing Director',
    location: 'Lagos Spirits Co.',
    rating: 5,
  },
  {
    quote: 'We run three shops and a warehouse. The multi-location dashboard means I don\'t have to drive to each one to check stock — I see everything from my phone.',
    author: 'Ngozi Eze',
    role: 'Founder',
    location: 'Abuja Craft Distillery',
    rating: 5,
  },
  {
    quote: 'The analytics showed us that Hennessy outsells everything 3-to-1 on Friday nights. We adjusted our stocking and never missed a sale since.',
    author: 'Emeka Nwosu',
    role: 'Bar Manager',
    location: 'The Velvet Lounge, PH',
    rating: 5,
  },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQS: FaqItem[] = [
  {
    question: 'Do I need technical skills to use the ERM?',
    answer:
      'Not at all. The ERM is designed for business owners, not IT specialists. If you can use a smartphone, you can use DrinksHarbour ERM. Most vendors are fully up and running within a day.',
  },
  {
    question: 'Can I start for free?',
    answer:
      'Yes. The Free Trial plan gives you 50 SKUs, 1 staff member, and full access to inventory, orders, and the POS — at no cost. Upgrade when you\'re ready to scale.',
  },
  {
    question: 'What happens to my data if I cancel?',
    answer:
      'Your data is yours. If you decide to leave, we export everything — products, customers, order history — in standard formats. No lock-in, no hostage data.',
  },
  {
    question: 'Does it work on my phone?',
    answer:
      'Yes. The ERM dashboard is fully responsive and works on any device — phone, tablet, or desktop. The POS is optimised for tablets and touchscreen monitors.',
  },
  {
    question: 'How does the POS handle different payment methods?',
    answer:
      'The POS accepts cash, bank transfers, card payments, and mobile money. At the end of each cashier session, all payments are reconciled automatically so you know exactly what you collected.',
  },
  {
    question: 'Can I manage multiple shop locations?',
    answer:
      'Yes — on Pro, Enterprise, and Venue plans. You can see inventory, sales, and staff across all locations from a single dashboard, and transfer stock between them.',
  },
];

// ─── Capabilities ─────────────────────────────────────────────────────────────

export interface Capability {
  icon: IconComp;
  title: string;
  description: string;
  color: string;
}

export const CAPABILITIES: Capability[] = [
  {
    icon: Icon.PiMapPinLine,
    title: 'Multi-location',
    description: 'Manage inventory, sales, and staff across multiple shops and warehouses from a single dashboard.',
    color: 'bg-blue-50 text-blue-700',
  },
  {
    icon: Icon.PiShieldCheck,
    title: 'Roles & Permissions',
    description: 'Grant granular access so each team member sees only what they need — from cashier to owner.',
    color: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: Icon.PiCode,
    title: 'API Access',
    description: 'Connect your ERM to external tools and services via RESTful APIs available on Pro and higher plans.',
    color: 'bg-purple-50 text-purple-700',
  },
  {
    icon: Icon.PiArrowsClockwise,
    title: 'Real-time Sync',
    description: 'Inventory, orders, and sales data sync instantly across POS, online store, and warehouse modules.',
    color: 'bg-amber-50 text-amber-700',
  },
];
