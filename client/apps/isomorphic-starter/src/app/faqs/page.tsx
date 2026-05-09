'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Data ─────────────────────────────────────────────────────────────────────

type Category = 'all' | 'ordering' | 'delivery' | 'payments' | 'account' | 'products' | 'vendors';

interface FAQ {
  q: string;
  a: string;
  category: Exclude<Category, 'all'>;
}

const CATEGORIES: { key: Category; label: string; icon: React.ElementType }[] = [
  { key: 'all',      label: 'All Topics',    icon: Icon.PiListBold },
  { key: 'ordering', label: 'Ordering',      icon: Icon.PiShoppingCart },
  { key: 'delivery', label: 'Delivery',      icon: Icon.PiTruck },
  { key: 'payments', label: 'Payments',      icon: Icon.PiCreditCard },
  { key: 'account',  label: 'My Account',    icon: Icon.PiUser },
  { key: 'products', label: 'Products',      icon: Icon.PiWineBold },
  { key: 'vendors',  label: 'Vendors',       icon: Icon.PiStorefront },
];

const FAQS: FAQ[] = [
  // Ordering
  {
    category: 'ordering',
    q: 'How do I place an order?',
    a: 'Browse our shop, add items to your cart, then proceed to checkout. You\'ll need to create an account or log in, confirm your delivery address, and complete payment. You\'ll receive an order confirmation by email and SMS immediately.',
  },
  {
    category: 'ordering',
    q: 'Can I modify or cancel my order after placing it?',
    a: 'You can cancel or modify your order within 30 minutes of placing it by visiting My Orders in your account and selecting "Cancel / Edit". After that window, the order may already be packed and dispatched. Contact our support team as soon as possible if you need help.',
  },
  {
    category: 'ordering',
    q: 'Is there a minimum order amount?',
    a: 'There is no minimum order amount. However, free standard delivery applies to orders of ₦50,000 and above. Orders below that threshold attract a flat delivery fee that is shown at checkout.',
  },
  {
    category: 'ordering',
    q: 'Can I order in bulk for an event or business?',
    a: 'Yes! For bulk or wholesale orders (50 bottles or more), please contact us via the Contact page or WhatsApp. We offer preferential pricing, dedicated account management, and flexible delivery scheduling for large orders.',
  },
  {
    category: 'ordering',
    q: 'Can I schedule a delivery for a specific date?',
    a: 'Yes. During checkout you can select a preferred delivery date. Scheduled deliveries are subject to availability in your area. Same-day scheduling must be placed before 12 noon.',
  },

  // Delivery
  {
    category: 'delivery',
    q: 'Which areas do you deliver to?',
    a: 'We deliver to all 36 states and the FCT across Nigeria. Same-day delivery is available in Abuja and Lagos. Next-day delivery covers Port Harcourt, Kano, Ibadan, Enugu, and other major cities. Remote areas may take 2–4 business days.',
  },
  {
    category: 'delivery',
    q: 'How long does delivery take?',
    a: 'Abuja & Lagos: same-day (orders before 12 noon) or next day. Other major cities: 1–2 business days. Remaining states: 2–4 business days. You will receive SMS and email updates at each stage of your delivery.',
  },
  {
    category: 'delivery',
    q: 'How do I track my order?',
    a: 'Once your order is dispatched, you will receive a tracking link via SMS and email. You can also log in to your account, go to My Orders, and click "Track Order" for real-time updates.',
  },
  {
    category: 'delivery',
    q: 'What happens if I am not home when my order arrives?',
    a: 'Our delivery partner will attempt to call you. If unreachable, they will leave a delivery notice and attempt re-delivery the next business day. After two failed attempts the order is returned to our warehouse and you will need to reschedule.',
  },
  {
    category: 'delivery',
    q: 'Can I change my delivery address after ordering?',
    a: 'Yes, as long as the order has not yet been dispatched. Go to My Orders and select "Change Address", or contact our support team. Address changes after dispatch are not possible.',
  },

  // Payments
  {
    category: 'payments',
    q: 'What payment methods do you accept?',
    a: 'We accept debit and credit cards (Visa, Mastercard, Verve), bank transfers, USSD, and mobile money via Paystack. International cards are accepted via Stripe. All prices are displayed and charged in Nigerian Naira (₦).',
  },
  {
    category: 'payments',
    q: 'Is it safe to save my card details?',
    a: 'Yes. Card details are tokenised by Paystack and Stripe — we never store your raw card numbers on our servers. Saved cards can be managed or deleted at any time from your account settings.',
  },
  {
    category: 'payments',
    q: 'I was charged but didn\'t receive an order confirmation. What should I do?',
    a: 'This can happen due to a brief network delay. Wait 5–10 minutes and check your spam folder. If no confirmation arrives, check your bank statement and contact us with the transaction reference — we will resolve it within 2 hours.',
  },
  {
    category: 'payments',
    q: 'Do you offer buy now, pay later?',
    a: 'We are working on instalment payment options for select customers. If you are interested, sign up for our newsletter to be notified when it launches.',
  },
  {
    category: 'payments',
    q: 'How are refunds processed?',
    a: 'Approved refunds are returned to your original payment method within 3–5 business days. For bank transfers and USSD payments, refunds go to the registered bank account. You will receive an email confirmation once the refund is initiated.',
  },

  // Account
  {
    category: 'account',
    q: 'How do I create an account?',
    a: 'Click "Sign Up" at the top of the page. You can register with your email and a password, or sign up instantly with your Google account. A verification email will be sent — click the link to activate your account.',
  },
  {
    category: 'account',
    q: 'How do I reset my password?',
    a: 'On the login page, click "Forgot password?". Enter your registered email address and we will send a password reset link valid for 30 minutes. If you don\'t receive it, check your spam folder or contact support.',
  },
  {
    category: 'account',
    q: 'Can I have multiple delivery addresses?',
    a: 'Yes. You can save multiple delivery addresses in your account under Settings → Addresses. You can set a default address and choose a different one at checkout.',
  },
  {
    category: 'account',
    q: 'How do I delete my account?',
    a: 'Go to Settings → Account → Delete Account. Please note that deleting your account permanently removes your order history, saved addresses, and wishlist. If you just want a break, you can deactivate instead.',
  },

  // Products
  {
    category: 'products',
    q: 'Are all products on DrinksHarbour authentic?',
    a: 'Yes. Every vendor on our platform is verified and must provide documentation of supply chain authenticity before listing. We conduct regular audits and take immediate action against any vendor found selling counterfeit goods.',
  },
  {
    category: 'products',
    q: 'How are prices determined?',
    a: 'Prices are set by individual vendors and are displayed in Naira (₦). DrinksHarbour may apply platform-wide promotions or negotiated discounts on top of vendor prices. The price you see at checkout is the final price — no hidden charges.',
  },
  {
    category: 'products',
    q: 'Why is a product showing "Out of Stock"?',
    a: 'Inventory is synced in real-time with each vendor\'s stock. If a product is out of stock, the vendor has no available units. You can click "Notify me" on the product page to receive an email when it\'s back in stock.',
  },
  {
    category: 'products',
    q: 'What does ABV mean on product cards?',
    a: 'ABV stands for Alcohol By Volume — it is the percentage of alcohol in the drink. For example, a whisky at 43% ABV contains 43 ml of pure alcohol per 100 ml. We display ABV to help you make informed choices.',
  },

  // Vendors
  {
    category: 'vendors',
    q: 'How do I become a vendor on DrinksHarbour?',
    a: 'Visit the Vendor Registration page, fill in your business details, upload the required documentation (CAC certificate, NAFDAC approvals where applicable), and submit for review. Approval typically takes 2–3 business days.',
  },
  {
    category: 'vendors',
    q: 'What fees do vendors pay?',
    a: 'DrinksHarbour charges a commission on each sale, which varies by product category. There are no monthly listing fees. Full fee details are provided in the Vendor Agreement during onboarding.',
  },
  {
    category: 'vendors',
    q: 'How do vendors receive payment?',
    a: 'Vendor payouts are processed every Friday for all orders delivered and confirmed in the preceding week. Funds are transferred directly to your registered bank account.',
  },
  {
    category: 'vendors',
    q: 'Can vendors manage their own inventory?',
    a: 'Yes. The vendor dashboard provides full inventory management — add products, update stock levels, set prices, upload images, and run promotions. Changes reflect live on the storefront within minutes.',
  },
];

// ─── Accordion item ───────────────────────────────────────────────────────────

function AccordionItem({ faq, index }: { faq: FAQ; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`bg-white rounded-2xl border transition-all ${open ? 'border-red-200 shadow-md' : 'border-gray-100 shadow-sm'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-6 h-6 rounded-full bg-red-50 text-red-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <span className="font-semibold text-gray-900 text-sm leading-snug">{faq.q}</span>
        </div>
        <div className={`w-7 h-7 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${open ? 'bg-red-700 border-red-700 text-white' : 'border-gray-200 text-gray-400'}`}>
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ duration: 0.2 }}>
            <Icon.PiPlus size={14} />
          </motion.span>
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-sm text-gray-600 leading-relaxed border-t border-gray-50 pt-3 ml-9">
              {faq.a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FAQPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return FAQS.filter(f => {
      const matchCat = activeCategory === 'all' || f.category === activeCategory;
      const matchSearch = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [activeCategory, search]);

  // Group filtered items by category for display
  const grouped = useMemo(() => {
    if (activeCategory !== 'all') {
      return [{ key: activeCategory, items: filtered }];
    }
    const map: Record<string, FAQ[]> = {};
    filtered.forEach(f => {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    });
    return Object.entries(map).map(([key, items]) => ({ key: key as Category, items }));
  }, [filtered, activeCategory]);

  const getCategoryLabel = (key: Category) =>
    CATEGORIES.find(c => c.key === key)?.label ?? key;

  const getCategoryIcon = (key: Category) =>
    CATEGORIES.find(c => c.key === key)?.icon ?? Icon.PiListBold;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>

        <div className="container mx-auto max-w-3xl px-4 py-16 relative text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
            <Icon.PiQuestion size={13} />
            Help Centre
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto mb-7">
            Quick answers to common questions about ordering, delivery, payments, and more.
          </p>

          {/* Search */}
          <div className="relative max-w-lg mx-auto">
            <Icon.PiMagnifyingGlass
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions…"
              className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-white/40 focus:bg-white/15 transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <Icon.PiX size={15} />
              </button>
            )}
          </div>
        </div>

        {/* wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
            <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
          </svg>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-10 pb-16">

        {/* ── Category tabs ───────────────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map(({ key, label, icon: Ic }) => {
            const active = activeCategory === key;
            return (
              <button
                key={key}
                onClick={() => setActiveCategory(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  active
                    ? 'bg-red-700 border-red-700 text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-red-200 hover:text-red-700'
                }`}
              >
                <Ic size={14} />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Results count ───────────────────────────────────────────────── */}
        {search && (
          <p className="text-sm text-gray-500 mb-5">
            {filtered.length === 0
              ? 'No results found.'
              : `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${search}"`}
          </p>
        )}

        {/* ── FAQ groups ──────────────────────────────────────────────────── */}
        {grouped.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Icon.PiMagnifyingGlass size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="font-semibold text-gray-700 mb-1">No questions found</p>
            <p className="text-sm text-gray-400 mb-5">Try a different search term or browse all topics.</p>
            <button
              onClick={() => { setSearch(''); setActiveCategory('all'); }}
              className="text-sm text-red-700 font-semibold hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ key, items }) => {
              const Ic = getCategoryIcon(key as Category);
              return (
                <section key={key} id={key}>
                  {activeCategory === 'all' && (
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 bg-red-50 text-red-700 rounded-lg flex items-center justify-center">
                        <Ic size={16} />
                      </div>
                      <h2 className="text-base font-black text-gray-900">
                        {getCategoryLabel(key as Category)}
                      </h2>
                      <span className="text-xs text-gray-400 font-medium bg-gray-100 rounded-full px-2 py-0.5">
                        {items.length}
                      </span>
                    </div>
                  )}
                  <div className="space-y-3">
                    {items.map((faq, i) => (
                      <AccordionItem key={faq.q} faq={faq} index={i} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {/* ── Still need help ─────────────────────────────────────────────── */}
        <div className="mt-14 bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon.PiHeadset size={24} />
          </div>
          <h2 className="text-lg font-black text-gray-900 mb-2">Still need help?</h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
            Our support team is available Monday–Friday 9 am–6 pm, Saturday 10 am–4 pm.
            WhatsApp AI support runs 24/7.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
            >
              <Icon.PiEnvelope size={16} /> Send a Message
            </Link>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE || '2348000000000'}?text=${encodeURIComponent('Hi DrinksHarbour! I need help with ')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#25D366] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-[#1ebe5d] transition-all"
            >
              <Icon.PiWhatsappLogo size={16} /> Chat on WhatsApp
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
