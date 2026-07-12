import React from 'react';
import * as Icon from 'react-icons/pi';
import {
  P, Lead, SubHeading, BulletList, Callout, DataTable, MailLink,
} from './ui';

export interface PolicySectionDef {
  id: string;
  title: string;
  icon: React.ElementType;
  Body: React.FC;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART A — Who we are, what we collect, how & why we use it, sharing, cookies
// ═══════════════════════════════════════════════════════════════════════════════

export const SECTIONS_A: PolicySectionDef[] = [
  {
    id: 'introduction',
    title: 'Introduction & Who We Are',
    icon: Icon.PiInfoBold,
    Body: () => (
      <>
        <Lead>
          DrinksHarbour Technologies Ltd (&ldquo;DrinksHarbour&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
          operates the online beverage marketplace at{' '}
          <span className="font-semibold text-gray-800">drinksharbour.com</span> and the branded
          storefronts and business tools hosted on our platform. This Privacy Policy explains how we
          collect, use, share, and protect personal data when you use our website, mobile experiences,
          and services (together, the &ldquo;Services&rdquo;).
        </Lead>
        <P>
          DrinksHarbour is a <strong className="text-gray-800">multi-tenant platform</strong>. The
          central marketplace lists a single catalogue of beverages, but orders are routed to and
          fulfilled by independent partner businesses (&ldquo;Merchants&rdquo; or
          &ldquo;Tenants&rdquo;) that operate their own branded stores on our platform. This affects
          who controls your data:
        </P>
        <BulletList items={[
          <>When you browse the main marketplace, create a DrinksHarbour account, or place an order, DrinksHarbour is the <strong>data controller</strong>.</>,
          <>When a Merchant fulfils your order or you interact with a Merchant&rsquo;s own branded storefront, that Merchant acts as an <strong>independent data controller</strong> for the data it collects and uses through its own store and business tools, and its own privacy notice may also apply.</>,
          <>We share only the personal data a Merchant needs to fulfil and support your order (see &ldquo;How We Share Your Information&rdquo;).</>,
        ]} />
        <Callout tone="info">
          By using DrinksHarbour, you acknowledge you have read this Policy. Where we rely on your
          consent (for example, marketing or non-essential cookies), we ask for it separately and you
          may withdraw it at any time. If you do not agree with this Policy, please discontinue use of
          the Services.
        </Callout>
      </>
    ),
  },

  {
    id: 'definitions',
    title: 'Key Definitions',
    icon: Icon.PiBookOpenTextBold,
    Body: () => (
      <>
        <P>To make this Policy clear, the following terms have specific meanings:</P>
        <BulletList items={[
          <><strong>Personal Data</strong> — any information relating to an identified or identifiable person (e.g. name, email, phone, delivery address, device identifiers).</>,
          <><strong>Processing</strong> — any operation performed on personal data, such as collecting, storing, using, sharing, or deleting it.</>,
          <><strong>Controller</strong> — the party that decides why and how personal data is processed.</>,
          <><strong>Processor / Sub-processor</strong> — a third party that processes personal data on a controller&rsquo;s behalf under contract (e.g. our payment, hosting, and email providers).</>,
          <><strong>Merchant / Tenant</strong> — an independent partner business that subscribes to DrinksHarbour, operates a branded storefront, and fulfils marketplace orders.</>,
          <><strong>NDPA / NDPR</strong> — the Nigeria Data Protection Act 2023 and the Nigeria Data Protection Regulation 2019, the primary laws governing this Policy, overseen by the Nigeria Data Protection Commission (&ldquo;NDPC&rdquo;).</>,
        ]} />
      </>
    ),
  },

  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    icon: Icon.PiDatabaseBold,
    Body: () => (
      <>
        <P>
          We collect information you provide directly, information collected automatically as you use
          the Services, and information we receive from trusted third parties.
        </P>

        <SubHeading>Information you provide to us</SubHeading>
        <BulletList items={[
          'Identity & contact details — name, email address, phone number, and one or more delivery addresses when you register or checkout',
          'Account credentials — a securely hashed password, and (if enabled) multi-factor authentication settings',
          'Payment information — processed securely by our payment partners; we receive confirmation and limited transaction metadata but never store your raw card number or CVV',
          'Order & preference data — cart contents, order history, wishlists, saved searches, and communication preferences',
          'Loyalty data — your Corks & Points balance, tier, referrals, and reward activity',
          'Content you submit — product reviews, ratings, messages and attachments sent via our contact form, WhatsApp, or live support',
          'Merchant onboarding data — for businesses applying to sell: business name, registration/CAC number, contact person, address, and payout bank details',
          'Age-verification confirmation — because we sell alcohol, confirmation that you are 18 years or older',
        ]} />

        <SubHeading>Information collected automatically</SubHeading>
        <BulletList items={[
          'Device & connection data — IP address, browser type, operating system, and device identifiers',
          'Usage data — pages visited, time on site, referring URLs, search queries, and click-through activity',
          'Cookies & local storage — as described in the Cookies & Tracking section',
          'Approximate location — city or state level, inferred from your IP address (we do not collect precise GPS location without your permission)',
        ]} />

        <SubHeading>Information from third parties</SubHeading>
        <BulletList items={[
          'Authentication data when you choose to sign in with Google',
          'Payment confirmation and fraud/risk signals from Korapay and Paystack',
          'Delivery status updates from our logistics and courier partners',
          'Limited data from Merchants where you have transacted with their storefront',
        ]} />
      </>
    ),
  },

  {
    id: 'how-we-use',
    title: 'How We Use Your Information',
    icon: Icon.PiGearBold,
    Body: () => (
      <>
        <P>We use the information we collect to operate, secure, and improve the Services, specifically to:</P>
        <BulletList items={[
          'Process and fulfil your orders, including routing them to the relevant Merchant and arranging delivery',
          'Manage your account, authenticate logins, and enable multi-factor authentication',
          'Send transactional messages — order confirmations, delivery updates, receipts, and support replies — by email and SMS',
          'Operate the Corks & Points loyalty programme, referrals, and reward redemptions',
          'Verify age (18+) and prevent underage sale of alcohol',
          'Detect, investigate, and prevent fraud, abuse, and unauthorised account access',
          'Personalise your experience — recommendations, saved searches, and relevant catalogue results (see AI & Automated Processing)',
          'Send marketing and offers where you have opted in — you can unsubscribe at any time',
          'Analyse usage to improve performance, design, search relevance, and the product catalogue',
          'Comply with Nigerian law, including NDPA/NDPR, tax, and accounting obligations',
          'Resolve disputes, enforce our Terms of Service, and protect the rights and safety of users, Merchants, and DrinksHarbour',
        ]} />
        <Callout tone="success">
          We do <strong>not</strong> sell your personal data. We do not share your data with third
          parties for their own independent marketing without your consent.
        </Callout>
      </>
    ),
  },

  {
    id: 'legal-bases',
    title: 'Legal Bases for Processing',
    icon: Icon.PiScalesBold,
    Body: () => (
      <>
        <P>
          Under the NDPA and NDPR, we only process your personal data where we have a lawful basis.
          Depending on the activity, we rely on one or more of the following:
        </P>
        <DataTable
          columns={['Lawful basis', 'When we rely on it']}
          rows={[
            ['Performance of a contract', 'To create your account, process and deliver your orders, and provide support you request'],
            ['Consent', 'For opt-in marketing, non-essential cookies, and any collection of sensitive or precise-location data — withdrawable at any time'],
            ['Legitimate interests', 'To secure the platform, prevent fraud, improve our Services, and offer relevant recommendations, balanced against your rights'],
            ['Legal obligation', 'To keep tax and transaction records, respond to lawful requests, and meet regulatory duties under Nigerian law'],
          ]}
        />
        <P>
          Where processing is based on consent, withdrawing it will not affect the lawfulness of
          processing carried out before withdrawal. To withdraw consent or object to processing based
          on legitimate interests, contact <MailLink email="privacy@drinksharbour.com" />.
        </P>
      </>
    ),
  },

  {
    id: 'ai-processing',
    title: 'AI & Automated Processing',
    icon: Icon.PiRobotBold,
    Body: () => (
      <>
        <P>
          DrinksHarbour uses artificial-intelligence and machine-learning features to improve
          discovery and quality. We are transparent about how these process your data:
        </P>
        <BulletList items={[
          'Semantic search & recommendations — we generate vector embeddings from product data and, where relevant, your search and browsing signals to return more relevant results and suggestions',
          'Review sentiment analysis — automated models help summarise and moderate product reviews',
          'Image auto-tagging — uploaded product images are automatically tagged to improve catalogue quality',
          'Demand forecasting — aggregated, non-identifying sales data helps Merchants plan inventory',
        ]} />
        <Callout tone="warning">
          These features support personalisation and platform quality. We do <strong>not</strong> make
          decisions that produce legal or similarly significant effects about you based solely on
          automated processing. Where personalisation relies on your consent, you can opt out in your
          account preferences or by contacting us — you will still be able to browse and buy without it.
        </Callout>
      </>
    ),
  },

  {
    id: 'sharing',
    title: 'How We Share Your Information',
    icon: Icon.PiShareNetworkBold,
    Body: () => (
      <>
        <P>We share personal data only as necessary to deliver the Services and as described below:</P>
        <BulletList items={[
          <><strong>Merchants (Tenants)</strong> — your name, delivery address, contact number, and order details are shared with the Merchant fulfilling your order so they can prepare and dispatch it.</>,
          <><strong>Logistics & courier partners</strong> — name, phone, and delivery address are shared to complete delivery and provide tracking.</>,
          <><strong>Payment processors</strong> — Korapay (marketplace checkout, in Naira) and Paystack (subscription and recurring billing) receive the data needed to process payments securely.</>,
          <><strong>Infrastructure & service providers</strong> — cloud hosting, database, media (Cloudinary), and email/SMS providers that operate the platform on our behalf under contract.</>,
          <><strong>Analytics providers</strong> — anonymised or aggregated data to help us understand and improve usage.</>,
          <><strong>Professional & legal</strong> — auditors, advisers, or authorities where required by Nigerian law, court order, or to protect our legal rights and user safety.</>,
          <><strong>Business transfers</strong> — if DrinksHarbour is involved in a merger, acquisition, or asset sale, data may transfer under equivalent protections and with notice to you.</>,
        ]} />
        <Callout tone="info">
          We contractually require all processors to protect your data, act only on our instructions,
          and never use it for their own marketing. Merchants are independently responsible for their
          own lawful handling of the order data we pass to them.
        </Callout>
      </>
    ),
  },

  {
    id: 'sub-processors',
    title: 'Sub-Processors & Third-Party Services',
    icon: Icon.PiStackBold,
    Body: () => (
      <>
        <P>
          We rely on a small number of vetted service providers to run the platform. Key categories
          and providers include:
        </P>
        <DataTable
          columns={['Provider', 'Purpose', 'Data involved']}
          rows={[
            ['Korapay', 'Marketplace payment processing (NGN)', 'Transaction & payment metadata'],
            ['Paystack', 'Subscription & recurring billing', 'Billing & payment metadata'],
            ['Cloudinary', 'Image storage & delivery', 'Uploaded images & derived tags'],
            ['Cloud hosting & database', 'Application hosting, storage & caching', 'Account, order & usage data'],
            ['Email & SMS provider', 'Transactional & opt-in messaging', 'Name, email, phone'],
            ['Google', 'Optional sign-in (OAuth)', 'Authentication profile data'],
            ['Analytics', 'Usage measurement (aggregated)', 'Anonymised usage data'],
          ]}
        />
        <P>
          This list may change as our providers evolve. A current list is available on request at{' '}
          <MailLink email="privacy@drinksharbour.com" />.
        </P>
      </>
    ),
  },

  {
    id: 'international-transfers',
    title: 'International Data Transfers',
    icon: Icon.PiGlobeBold,
    Body: () => (
      <>
        <P>
          Some of our service providers store or process data outside Nigeria. Where we transfer
          personal data internationally, we take steps required by the NDPA/NDPR to ensure an adequate
          level of protection, which may include:
        </P>
        <BulletList items={[
          'Transferring only to countries or providers that offer adequate data-protection safeguards',
          'Putting contractual data-protection clauses in place with the recipient',
          'Relying on your explicit consent where appropriate for a specific transfer',
          'Minimising the data transferred to what is strictly necessary',
        ]} />
        <P>
          You can ask us for more detail about the safeguards applied to a specific transfer by
          contacting our Data Protection Officer.
        </P>
      </>
    ),
  },

  {
    id: 'cookies',
    title: 'Cookies & Tracking',
    icon: Icon.PiCookieBold,
    Body: () => (
      <>
        <P>We use cookies and similar technologies to keep the Services working and to improve them. The main categories are:</P>
        <DataTable
          columns={['Type', 'Purpose', 'Duration']}
          rows={[
            ['Essential', 'Authentication, cart, and checkout functionality', 'Session / 30 days'],
            ['Preference', 'Remembering language and display settings', '1 year'],
            ['Analytics', 'Understanding how visitors use the site (anonymised)', '90 days'],
            ['Marketing', 'Showing relevant offers on partner platforms (opt-in only)', '90 days'],
          ]}
        />
        <P>
          You can control cookies through your browser settings and manage non-essential cookies via
          your account preferences. Disabling essential cookies will affect core functionality such as
          login and checkout. Marketing cookies are set only with your consent and can be withdrawn at
          any time.
        </P>
      </>
    ),
  },
];
