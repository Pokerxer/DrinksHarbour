'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Table of contents ────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'information-we-collect',    title: 'Information We Collect',       icon: Icon.PiDatabaseBold },
  { id: 'how-we-use',               title: 'How We Use Your Information',   icon: Icon.PiGearBold },
  { id: 'sharing',                  title: 'Sharing Your Information',      icon: Icon.PiShareNetworkBold },
  { id: 'cookies',                  title: 'Cookies & Tracking',            icon: Icon.PiCookieBold },
  { id: 'data-security',            title: 'Data Security',                 icon: Icon.PiShieldCheckBold },
  { id: 'your-rights',              title: 'Your Rights',                   icon: Icon.PiUserBold },
  { id: 'data-retention',           title: 'Data Retention',                icon: Icon.PiClockBold },
  { id: 'third-party',              title: 'Third-Party Links',             icon: Icon.PiLinkBold },
  { id: 'children',                 title: "Children's Privacy",            icon: Icon.PiProhibitBold },
  { id: 'changes',                  title: 'Changes to This Policy',        icon: Icon.PiNotePencilBold },
  { id: 'contact',                  title: 'Contact Us',                    icon: Icon.PiEnvelopeBold },
];

// ─── Prose section wrapper ────────────────────────────────────────────────────

function PolicySection({
  id, title, icon: Ic, children,
}: {
  id: string; title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-red-50 text-red-700 rounded-xl flex items-center justify-center flex-shrink-0">
          <Ic size={18} />
        </div>
        <h2 className="text-lg font-black text-gray-900">{title}</h2>
      </div>
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed pl-12">
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Ul({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map(item => (
        <li key={item} className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0 mt-2" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-red-50 border-l-4 border-red-600 rounded-r-xl p-4 text-sm text-gray-700 leading-relaxed">
      {children}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState('information-we-collect');
  const [tocOpen, setTocOpen] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Highlight active section in TOC as user scrolls
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setTocOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-700 opacity-10 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500 opacity-10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />
        </div>
        <div className="container mx-auto max-w-5xl px-4 py-16 relative">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-medium text-red-300 mb-5">
              <Icon.PiShieldCheck size={13} />
              Legal
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Privacy Policy</h1>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-4">
              We take your privacy seriously. This policy explains what data we collect,
              why we collect it, and how we keep it safe.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <Icon.PiCalendar size={13} className="text-red-400" />
                Last updated: 8 May 2025
              </span>
              <span className="flex items-center gap-1.5">
                <Icon.PiMapPin size={13} className="text-red-400" />
                Applies to: drinksharbour.com
              </span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-12">
            <path d="M0 48L1440 48L1440 12C1200 44 960 56 720 40C480 24 240 0 0 12L0 48Z" fill="rgb(249 250 251)" />
          </svg>
        </div>
      </div>

      <div className="container mx-auto max-w-5xl px-4 py-10 pb-16">
        <div className="grid lg:grid-cols-4 gap-8 items-start">

          {/* ── Sidebar TOC (desktop) ──────────────────────────────────────── */}
          <aside className="hidden lg:block lg:col-span-1 sticky top-24">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3 px-1">Contents</p>
              <nav className="space-y-0.5">
                {SECTIONS.map(({ id, title, icon: Ic }) => {
                  const active = activeSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => scrollTo(id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium transition-all ${
                        active
                          ? 'bg-red-50 text-red-700 font-semibold'
                          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <Ic size={13} className={active ? 'text-red-700' : 'text-gray-400'} />
                      <span className="leading-snug">{title}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* ── Mobile TOC toggle ──────────────────────────────────────────── */}
          <div className="lg:hidden col-span-full">
            <button
              onClick={() => setTocOpen(o => !o)}
              className="w-full flex items-center justify-between bg-white border border-gray-100 shadow-sm rounded-2xl px-5 py-3 text-sm font-semibold text-gray-700"
            >
              <span className="flex items-center gap-2">
                <Icon.PiList size={16} className="text-red-700" /> Table of Contents
              </span>
              <motion.span animate={{ rotate: tocOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <Icon.PiCaretDown size={15} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {tocOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white border border-t-0 border-gray-100 rounded-b-2xl shadow-sm px-4 pb-4 pt-2 grid grid-cols-2 gap-1">
                    {SECTIONS.map(({ id, title, icon: Ic }) => (
                      <button
                        key={id}
                        onClick={() => scrollTo(id)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-600 hover:bg-red-50 hover:text-red-700 transition-all text-left"
                      >
                        <Ic size={12} className="flex-shrink-0 text-red-500" />
                        {title}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Policy content ─────────────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-10">

            {/* Intro box */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <Highlight>
                By using DrinksHarbour — including browsing our website, creating an account, or placing an order — you agree to the collection and use of information as described in this Privacy Policy. If you do not agree, please discontinue use of our services.
              </Highlight>
            </div>

            {/* 1 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
              <PolicySection id="information-we-collect" title="Information We Collect" icon={Icon.PiDatabaseBold}>
                <P>We collect information you provide directly, information collected automatically, and information from third parties.</P>
                <div>
                  <p className="font-semibold text-gray-800 mb-2">Information you provide:</p>
                  <Ul items={[
                    'Name, email address, phone number, and delivery address when you register or checkout',
                    'Payment details processed securely via Korapay and Stripe (we never store raw card numbers)',
                    'Messages and attachments you send via our contact form or WhatsApp support',
                    'Profile preferences, wishlist items, and order history',
                    'Vendor registration details including business name, CAC number, and bank details',
                  ]} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-2">Information collected automatically:</p>
                  <Ul items={[
                    'IP address, browser type, operating system, and device identifiers',
                    'Pages visited, time on site, referring URLs, and click-through data',
                    'Cookies and local storage data (see Cookies section)',
                    'Location data at city or state level inferred from your IP address',
                  ]} />
                </div>
                <div>
                  <p className="font-semibold text-gray-800 mb-2">Information from third parties:</p>
                  <Ul items={[
                    'Authentication data when you sign in with Google',
                    'Payment confirmation and fraud signals from Korapay and Stripe',
                    'Delivery status updates from our logistics partners',
                  ]} />
                </div>
              </PolicySection>
            </div>

            {/* 2 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="how-we-use" title="How We Use Your Information" icon={Icon.PiGearBold}>
                <P>We use the information we collect to operate and improve our services, specifically to:</P>
                <Ul items={[
                  'Process and fulfil your orders, including notifying vendors and arranging delivery',
                  'Send order confirmations, delivery updates, and support replies via email and SMS',
                  'Verify your identity and prevent fraud or unauthorised account access',
                  'Personalise your shopping experience — product recommendations, saved searches, and wishlists',
                  'Send promotional emails and offers where you have opted in (you may unsubscribe at any time)',
                  'Analyse usage patterns to improve site performance, design, and product catalogues',
                  'Comply with legal obligations under Nigerian law, including NDPR requirements',
                  'Resolve disputes and enforce our Terms of Service',
                ]} />
                <P>We do not sell your personal data to third parties for their own marketing purposes.</P>
              </PolicySection>
            </div>

            {/* 3 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="sharing" title="Sharing Your Information" icon={Icon.PiShareNetworkBold}>
                <P>We share your information only as necessary to deliver our services:</P>
                <Ul items={[
                  'Vendors — your name, delivery address, and order details are shared with the relevant vendor to fulfil your order',
                  'Logistics partners — name, phone, and delivery address are shared with our courier partners',
                  'Payment processors — Korapay and Stripe receive transaction data to process payments securely',
                  'Cloud & infrastructure providers — we use AWS and Cloudinary to store data and images',
                  'Analytics services — anonymised, aggregated data may be shared with analytics tools',
                  'Law enforcement — we may disclose information when required by Nigerian law or court order',
                ]} />
                <Highlight>
                  We require all third-party service providers to maintain adequate security and to use your data only for the purposes we specify. We do not permit them to use your data for their own marketing.
                </Highlight>
              </PolicySection>
            </div>

            {/* 4 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="cookies" title="Cookies & Tracking" icon={Icon.PiCookieBold}>
                <P>We use cookies and similar technologies to provide a better experience. Types of cookies we use:</P>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left p-3 font-bold text-gray-700 border border-gray-100 rounded-tl-lg">Type</th>
                        <th className="text-left p-3 font-bold text-gray-700 border border-gray-100">Purpose</th>
                        <th className="text-left p-3 font-bold text-gray-700 border border-gray-100 rounded-tr-lg">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { type: 'Essential',    purpose: 'Authentication, cart, and checkout functionality',  duration: 'Session / 30 days' },
                        { type: 'Preference',   purpose: 'Remembering your language and display settings',    duration: '1 year' },
                        { type: 'Analytics',    purpose: 'Understanding how visitors use the site (anonymised)', duration: '90 days' },
                        { type: 'Marketing',    purpose: 'Showing relevant ads on third-party platforms (opt-in only)', duration: '90 days' },
                      ].map(({ type, purpose, duration }) => (
                        <tr key={type} className="hover:bg-gray-50">
                          <td className="p-3 border border-gray-100 font-semibold text-gray-800">{type}</td>
                          <td className="p-3 border border-gray-100 text-gray-600">{purpose}</td>
                          <td className="p-3 border border-gray-100 text-gray-500">{duration}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <P>You can control cookies through your browser settings. Disabling essential cookies will affect site functionality. Marketing cookies can be opted out of at any time via your account preferences.</P>
              </PolicySection>
            </div>

            {/* 5 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="data-security" title="Data Security" icon={Icon.PiShieldCheckBold}>
                <P>We implement industry-standard technical and organisational measures to protect your data:</P>
                <Ul items={[
                  'All data in transit is encrypted using TLS 1.2 or higher (HTTPS)',
                  'Passwords are hashed using bcrypt — we never store plain-text passwords',
                  'Payment card data is tokenised by Korapay and Stripe and never touches our servers',
                  'Access to production databases is restricted to authorised personnel with multi-factor authentication',
                  'Regular security audits and dependency vulnerability scans',
                  'Automated backups with encrypted off-site storage',
                ]} />
                <Highlight>
                  No method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security. If you suspect unauthorised access to your account, please contact us immediately at <a href="mailto:security@drinksharbour.com" className="text-red-700 font-semibold underline">security@drinksharbour.com</a>.
                </Highlight>
              </PolicySection>
            </div>

            {/* 6 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="your-rights" title="Your Rights" icon={Icon.PiUserBold}>
                <P>Under the Nigeria Data Protection Regulation (NDPR) and applicable law, you have the right to:</P>
                <Ul items={[
                  'Access — request a copy of the personal data we hold about you',
                  'Correction — ask us to correct inaccurate or incomplete data',
                  'Deletion — request deletion of your personal data, subject to legal obligations',
                  'Portability — receive your data in a machine-readable format',
                  'Objection — object to processing of your data for direct marketing at any time',
                  'Restriction — request that we restrict processing while a dispute is resolved',
                  'Withdraw consent — where processing is based on consent, you may withdraw it at any time',
                ]} />
                <P>
                  To exercise any of these rights, email us at{' '}
                  <a href="mailto:privacy@drinksharbour.com" className="text-red-700 font-semibold">privacy@drinksharbour.com</a>.
                  We will respond within 30 days. We may need to verify your identity before processing your request.
                </P>
              </PolicySection>
            </div>

            {/* 7 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="data-retention" title="Data Retention" icon={Icon.PiClockBold}>
                <Ul items={[
                  'Account data is retained for as long as your account is active',
                  'Order records are kept for 7 years to comply with Nigerian tax and accounting laws',
                  'Support messages and contact form submissions are retained for 2 years',
                  'Marketing preference data is retained until you unsubscribe or delete your account',
                  'Analytics data is anonymised after 90 days',
                  'Deleted accounts: personal identifiers are purged within 30 days; anonymised transaction records may be retained for legal compliance',
                ]} />
              </PolicySection>
            </div>

            {/* 8 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="third-party" title="Third-Party Links" icon={Icon.PiLinkBold}>
                <P>
                  Our website may contain links to third-party websites — including vendor social media pages,
                  payment processors, and blog references. These sites have their own privacy policies and we have
                  no responsibility for their content or practices.
                </P>
                <P>
                  We encourage you to review the privacy policy of any third-party site you visit via a link on DrinksHarbour.
                </P>
              </PolicySection>
            </div>

            {/* 9 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="children" title="Children's Privacy" icon={Icon.PiProhibitBold}>
                <P>
                  DrinksHarbour sells alcoholic beverages and our services are strictly for users aged
                  <strong className="text-gray-800"> 18 years and older</strong>. We do not knowingly
                  collect personal data from anyone under 18.
                </P>
                <P>
                  If we become aware that a minor has provided us with personal data, we will delete it
                  immediately. If you believe a minor has submitted data to us, please contact us at{' '}
                  <a href="mailto:privacy@drinksharbour.com" className="text-red-700 font-semibold">
                    privacy@drinksharbour.com
                  </a>.
                </P>
              </PolicySection>
            </div>

            {/* 10 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="changes" title="Changes to This Policy" icon={Icon.PiNotePencilBold}>
                <P>
                  We may update this Privacy Policy from time to time. When we make material changes,
                  we will notify you by:
                </P>
                <Ul items={[
                  'Posting a prominent notice on our website',
                  'Sending an email to your registered address at least 14 days before the changes take effect',
                  'Updating the "Last updated" date at the top of this page',
                ]} />
                <P>
                  Continued use of DrinksHarbour after the effective date of any changes constitutes
                  acceptance of the updated policy.
                </P>
              </PolicySection>
            </div>

            {/* 11 */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <PolicySection id="contact" title="Contact Us" icon={Icon.PiEnvelopeBold}>
                <P>
                  For privacy-related enquiries, data access requests, or to report a concern, please contact
                  our Data Protection Officer:
                </P>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  {[
                    { icon: Icon.PiBuildings,  label: 'DrinksHarbour Technologies Ltd' },
                    { icon: Icon.PiMapPin,      label: 'Abuja, Federal Capital Territory, Nigeria' },
                    { icon: Icon.PiEnvelope,    label: 'privacy@drinksharbour.com', href: 'mailto:privacy@drinksharbour.com' },
                    { icon: Icon.PiEnvelope,    label: 'support@drinksharbour.com', href: 'mailto:support@drinksharbour.com' },
                  ].map(({ icon: Ic, label, href }, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-gray-700">
                      <Ic size={15} className="text-red-600 flex-shrink-0" />
                      {href ? (
                        <a href={href} className="text-red-700 font-semibold hover:underline">{label}</a>
                      ) : (
                        <span>{label}</span>
                      )}
                    </div>
                  ))}
                </div>
                <P>We aim to respond to all privacy-related requests within <strong className="text-gray-800">30 days</strong>.</P>
              </PolicySection>
            </div>

            {/* Related links */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-bold text-gray-900 text-sm mb-4 flex items-center gap-2">
                <Icon.PiArrowSquareOut size={15} className="text-red-700" /> Related Policies
              </h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {[
                  { label: 'Terms of Service',   href: '/terms',           icon: Icon.PiFileBold },
                  { label: 'Cookie Policy',       href: '/cookie-policy',   icon: Icon.PiCookieBold },
                  { label: 'Returns Policy',      href: '/returns',         icon: Icon.PiArrowCounterClockwise },
                ].map(({ label, href, icon: Ic }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 hover:border-red-200 hover:bg-red-50 transition-all group"
                  >
                    <Ic size={15} className="text-red-600 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-700 group-hover:text-red-700 transition-colors">{label}</span>
                    <Icon.PiArrowRight size={12} className="ml-auto text-gray-300 group-hover:text-red-400 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon.PiEnvelopeBold size={24} />
              </div>
              <h2 className="text-lg font-black text-gray-900 mb-2">Questions about your data?</h2>
              <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                Our team is happy to help with any privacy or data-related queries.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all shadow-md"
              >
                <Icon.PiEnvelope size={16} /> Contact Us
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
