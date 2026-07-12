import React from 'react';
import * as Icon from 'react-icons/pi';
import {
  P, Lead, SubHeading, BulletList, Callout, DataTable, MailLink,
  type PolicySectionDef,
} from '@/components/legal/ui';

// ═══════════════════════════════════════════════════════════════════════════════
// Cookie Policy — what cookies are, which we use, why, and how to control them
// ═══════════════════════════════════════════════════════════════════════════════

export const COOKIE_SECTIONS: PolicySectionDef[] = [
  {
    id: 'introduction',
    title: 'About This Cookie Policy',
    icon: Icon.PiInfoBold,
    Body: () => (
      <>
        <Lead>
          This Cookie Policy explains how DrinksHarbour Technologies Ltd (&ldquo;DrinksHarbour&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo;) uses cookies and similar technologies on{' '}
          <span className="font-semibold text-gray-800">drinksharbour.com</span> and the storefronts
          hosted on our platform.
        </Lead>
        <P>
          It should be read together with our{' '}
          <a href="/privacy-policy" className="text-red-700 font-semibold hover:underline">Privacy Policy</a>,
          which describes how we handle your personal data more generally, and our{' '}
          <a href="/terms" className="text-red-700 font-semibold hover:underline">Terms of Service</a>.
          Because DrinksHarbour is a multi-tenant marketplace, a Merchant&rsquo;s branded storefront may
          also set its own cookies under its own notice.
        </P>
      </>
    ),
  },

  {
    id: 'what-are-cookies',
    title: 'What Are Cookies?',
    icon: Icon.PiCookieBold,
    Body: () => (
      <>
        <P>
          Cookies are small text files placed on your device when you visit a website. They let a site
          remember your actions and preferences over time. We also use similar technologies such as
          local storage, pixels, and software development kits (&ldquo;SDKs&rdquo;) — in this Policy we
          refer to all of these as &ldquo;cookies&rdquo;.
        </P>
        <BulletList items={[
          <><strong>First-party cookies</strong> are set by DrinksHarbour.</>,
          <><strong>Third-party cookies</strong> are set by our service providers (for example, payment or analytics partners).</>,
          <><strong>Session cookies</strong> expire when you close your browser; <strong>persistent cookies</strong> remain until they expire or you delete them.</>,
        ]} />
      </>
    ),
  },

  {
    id: 'how-we-use',
    title: 'How We Use Cookies',
    icon: Icon.PiGearBold,
    Body: () => (
      <>
        <P>We use cookies to keep the Services working, remember your choices, understand usage, and — with your consent — personalise offers. Specifically to:</P>
        <BulletList items={[
          'Keep you signed in and maintain your shopping cart and checkout session',
          'Remember your language, region, and display preferences',
          'Secure your account and help detect and prevent fraud',
          'Measure and improve site performance and search relevance (anonymised)',
          'Show relevant offers on our site and partner platforms, where you have opted in',
        ]} />
      </>
    ),
  },

  {
    id: 'categories',
    title: 'Types of Cookies We Use',
    icon: Icon.PiListChecksBold,
    Body: () => (
      <>
        <P>The cookies we use fall into four categories:</P>
        <DataTable
          columns={['Category', 'Purpose', 'Consent', 'Duration']}
          rows={[
            ['Essential', 'Authentication, cart, checkout, and security — the site cannot function without these', 'Always on', 'Session / 30 days'],
            ['Preference', 'Remembering language, region, and display settings', 'Optional', '1 year'],
            ['Analytics', 'Understanding how visitors use the site, anonymised and aggregated', 'Optional', '90 days'],
            ['Marketing', 'Showing relevant offers on our site and partner platforms', 'Opt-in only', '90 days'],
          ]}
        />
        <Callout tone="info">
          Essential cookies are strictly necessary and are always active. All other categories are
          optional and are only set with your consent, which you can change at any time.
        </Callout>
      </>
    ),
  },

  {
    id: 'third-party',
    title: 'Third-Party Cookies',
    icon: Icon.PiShareNetworkBold,
    Body: () => (
      <>
        <P>Some cookies are set by trusted third parties that help us operate the Services. Key examples include:</P>
        <DataTable
          columns={['Provider', 'Role', 'Category']}
          rows={[
            ['Korapay', 'Secure marketplace payments (NGN)', 'Essential'],
            ['Paystack', 'Subscription & recurring billing', 'Essential'],
            ['Google', 'Optional sign-in (OAuth)', 'Essential'],
            ['Analytics provider', 'Anonymised usage measurement', 'Analytics'],
            ['Advertising partners', 'Relevant offers (opt-in)', 'Marketing'],
          ]}
        />
        <P>
          These providers process data under their own privacy and cookie policies. We encourage you to
          review them. A current list of providers is available on request at{' '}
          <MailLink email="privacy@drinksharbour.com" />.
        </P>
      </>
    ),
  },

  {
    id: 'managing',
    title: 'Managing Your Cookies',
    icon: Icon.PiSlidersHorizontalBold,
    Body: () => (
      <>
        <P>You are in control of non-essential cookies. You can:</P>
        <BulletList items={[
          'Adjust your consent choices via our on-site cookie preferences at any time',
          'Manage marketing and personalisation preferences in your account settings',
          'Control or delete cookies through your browser settings',
          'Use your browser’s private/incognito mode to limit persistent cookies',
        ]} />

        <SubHeading>Browser controls</SubHeading>
        <P>
          Most browsers let you view, block, and delete cookies via their settings or help pages —
          including Chrome, Safari, Firefox, and Edge. Steps vary by browser and device.
        </P>

        <Callout tone="warning">
          Blocking essential cookies will break core features such as signing in, your cart, and
          checkout. Disabling analytics or marketing cookies will not affect your ability to shop.
        </Callout>
      </>
    ),
  },

  {
    id: 'changes',
    title: 'Changes to This Policy',
    icon: Icon.PiNotePencilBold,
    Body: () => (
      <>
        <P>
          We may update this Cookie Policy as our technologies and providers evolve. When we make
          material changes, we will update the &ldquo;Last updated&rdquo; date and, where appropriate,
          request fresh consent or notify you on-site.
        </P>
      </>
    ),
  },

  {
    id: 'contact',
    title: 'Contact Us',
    icon: Icon.PiEnvelopeBold,
    Body: () => (
      <>
        <P>For questions about our use of cookies, contact our Data Protection Officer:</P>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          {([
            { icon: Icon.PiBuildings, label: 'DrinksHarbour Technologies Ltd' },
            { icon: Icon.PiMapPin,     label: 'Abuja, Federal Capital Territory, Nigeria' },
            { icon: Icon.PiEnvelope,   label: 'privacy@drinksharbour.com', href: 'mailto:privacy@drinksharbour.com' },
            { icon: Icon.PiHeadset,    label: 'support@drinksharbour.com', href: 'mailto:support@drinksharbour.com' },
          ] as const).map(({ icon: Ic, label, href }, i) => (
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
      </>
    ),
  },
];
