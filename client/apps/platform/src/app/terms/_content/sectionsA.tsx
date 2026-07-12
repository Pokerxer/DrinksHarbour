import React from 'react';
import * as Icon from 'react-icons/pi';
import {
  P, Lead, SubHeading, BulletList, Callout, MailLink,
  type PolicySectionDef,
} from '@/components/legal/ui';

// ═══════════════════════════════════════════════════════════════════════════════
// PART A — Agreement, definitions, eligibility, accounts, marketplace, payments,
//          delivery, refunds, merchant terms, acceptable use
// ═══════════════════════════════════════════════════════════════════════════════

export const TERMS_A: PolicySectionDef[] = [
  {
    id: 'agreement',
    title: 'Agreement to These Terms',
    icon: Icon.PiHandshakeBold,
    Body: () => (
      <>
        <Lead>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the
          DrinksHarbour website, storefronts, and services operated by DrinksHarbour Technologies Ltd
          (&ldquo;DrinksHarbour&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By accessing or using the
          Services, creating an account, or placing an order, you agree to be bound by these Terms and
          our <a href="/privacy-policy" className="text-red-700 font-semibold hover:underline">Privacy Policy</a>.
        </Lead>
        <P>
          If you do not agree with these Terms, you must not use the Services. If you use the Services
          on behalf of a business (for example as a Merchant), you confirm you are authorised to bind
          that business to these Terms.
        </P>
        <Callout tone="warning">
          These Terms contain important provisions, including an age restriction (18+), limitations of
          our liability, and how disputes are resolved under Nigerian law. Please read them carefully.
        </Callout>
      </>
    ),
  },

  {
    id: 'definitions',
    title: 'Definitions',
    icon: Icon.PiBookOpenTextBold,
    Body: () => (
      <>
        <P>In these Terms:</P>
        <BulletList items={[
          <><strong>Platform / Services</strong> — the DrinksHarbour marketplace at drinksharbour.com, its storefronts, apps, and business tools.</>,
          <><strong>Marketplace</strong> — the central, single catalogue of beverages available to shoppers.</>,
          <><strong>Merchant / Tenant</strong> — an independent partner business that subscribes to DrinksHarbour, operates a branded storefront, and fulfils orders.</>,
          <><strong>Product</strong> — an item listed in the central catalogue.</>,
          <><strong>SubProduct</strong> — a Merchant’s sellable instance of a Product, holding its price, stock, and variants.</>,
          <><strong>User / you</strong> — any person who accesses or uses the Services, whether shopper or Merchant.</>,
        ]} />
      </>
    ),
  },

  {
    id: 'eligibility',
    title: 'Eligibility & Age Restriction',
    icon: Icon.PiWineBold,
    Body: () => (
      <>
        <P>
          DrinksHarbour sells alcoholic beverages. You must be at least{' '}
          <strong className="text-gray-800">18 years old</strong> to create an account or purchase
          alcohol. By using the Services you represent and warrant that you are 18 or older.
        </P>
        <BulletList items={[
          'We apply an age-verification gate on alcohol purchases and may request valid proof of age at checkout or on delivery',
          'We may refuse or cancel any order where age cannot be verified, or where delivery would be to a visibly intoxicated or underage person',
          'It is an offence to purchase alcohol on behalf of a person under 18',
        ]} />
        <Callout tone="danger">
          Please drink responsibly. We reserve the right to refuse service and to report suspected
          unlawful activity to the appropriate authorities.
        </Callout>
      </>
    ),
  },

  {
    id: 'accounts',
    title: 'Accounts & Registration',
    icon: Icon.PiUserCircleBold,
    Body: () => (
      <>
        <P>To access certain features you must create an account. You agree to:</P>
        <BulletList items={[
          'Provide accurate, current, and complete information and keep it up to date',
          'Keep your password confidential and enable multi-factor authentication where offered',
          'Be responsible for all activity that occurs under your account',
          'Notify us immediately of any unauthorised use at security@drinksharbour.com',
        ]} />
        <P>
          You may not share your account, use another person&rsquo;s account without permission, or
          create an account using false information. We may suspend or close accounts that breach these
          Terms.
        </P>
      </>
    ),
  },

  {
    id: 'marketplace',
    title: 'The Marketplace & How Orders Work',
    icon: Icon.PiStorefrontBold,
    Body: () => (
      <>
        <P>
          DrinksHarbour operates a <strong className="text-gray-800">multi-tenant marketplace</strong>.
          The Marketplace shows a single catalogue, but the products are sold and fulfilled by
          independent Merchants who operate their own stores on our Platform.
        </P>
        <BulletList items={[
          'When you place an order, your order is routed to the relevant Merchant(s) for fulfilment',
          'A single order may be split across more than one Merchant, and availability may vary by location',
          'The contract of sale for physical goods is between you and the fulfilling Merchant; DrinksHarbour provides the Platform, payment, and support that connect you',
          'We take reasonable care to show accurate catalogue information, but stock, pricing, and availability are set by Merchants and can change',
        ]} />
        <Callout tone="info">
          DrinksHarbour acts as the operator and intermediary of the Marketplace. Where we say a
          Merchant is responsible for something (such as fulfilment or product accuracy), that
          responsibility sits with that Merchant.
        </Callout>
      </>
    ),
  },

  {
    id: 'pricing-payment',
    title: 'Pricing, Payment & Taxes',
    icon: Icon.PiCreditCardBold,
    Body: () => (
      <>
        <P>All prices are shown in Nigerian Naira (₦) unless stated otherwise and may include or exclude applicable taxes and delivery fees as indicated at checkout.</P>
        <BulletList items={[
          'Marketplace payments are processed securely by Korapay; we never store your raw card details',
          'Merchant subscriptions and recurring charges are processed by Paystack',
          'You authorise us and our payment partners to charge your chosen payment method for the total shown at checkout',
          'If a price is listed incorrectly due to an obvious error, we or the Merchant may cancel the order and refund you',
          'You are responsible for any taxes, levies, or charges that apply to your purchase under Nigerian law',
        ]} />
        <P>
          Recurring subscriptions (for Merchants or subscription products) renew automatically until
          cancelled. You can manage or cancel a subscription from your account before the next billing
          date.
        </P>
      </>
    ),
  },

  {
    id: 'delivery',
    title: 'Delivery & Fulfilment',
    icon: Icon.PiTruckBold,
    Body: () => (
      <>
        <P>Orders are fulfilled by the relevant Merchant and delivered by our logistics or courier partners, or by the Merchant directly.</P>
        <BulletList items={[
          'Delivery times and fees are estimates and may vary by location, Merchant, and demand',
          'You must provide an accurate delivery address and be available to receive the order',
          'A valid proof of age (18+) may be required on delivery of alcohol; delivery may be refused without it',
          'Risk in the goods passes to you on delivery to your address or nominated recipient',
        ]} />
        <P>
          If an order is delayed, damaged, or incorrect, contact us at{' '}
          <MailLink email="support@drinksharbour.com" /> and we will help resolve it with the Merchant.
        </P>
      </>
    ),
  },

  {
    id: 'refunds',
    title: 'Cancellations, Returns & Refunds',
    icon: Icon.PiArrowCounterClockwiseBold,
    Body: () => (
      <>
        <P>
          Cancellations, returns, and refunds are handled in line with our{' '}
          <a href="/returns" className="text-red-700 font-semibold hover:underline">Returns Policy</a>{' '}
          and applicable Nigerian consumer law. In summary:
        </P>
        <BulletList items={[
          'You may cancel an order before it is dispatched, subject to the Merchant’s processing status',
          'Due to health and safety rules, alcohol and perishable goods may be non-returnable once delivered, except where faulty, damaged, or incorrectly supplied',
          'Approved refunds are made to your original payment method within a reasonable period',
          'Report any issue promptly with your order number and, where relevant, photos of the item',
        ]} />
      </>
    ),
  },

  {
    id: 'merchant-terms',
    title: 'Merchant (Tenant) Terms',
    icon: Icon.PiBuildingsBold,
    Body: () => (
      <>
        <P>If you register as a Merchant to sell on DrinksHarbour, the following additional terms apply to you:</P>
        <BulletList items={[
          'You must hold all licences and approvals required to sell beverages, including alcohol, under Nigerian law',
          'You subscribe to a plan billed via Paystack; plan tier determines your feature access, catalogue and staff limits, and marketplace commission rate',
          'DrinksHarbour deducts a commission on marketplace sales as set out in your plan; commission and subscription fees are non-refundable except as required by law',
          'You are the seller of record for your orders and are responsible for product accuracy, stock, pricing, fulfilment, and lawful handling of customer data shared with you',
          'You must not list prohibited, counterfeit, expired, or mislabelled products, and you must honour the prices and availability you publish',
          'We may suspend or remove listings, or your store, for breach of these Terms or applicable law',
        ]} />
        <Callout tone="info">
          New products a Merchant introduces enter the central catalogue as <strong>pending</strong>{' '}
          and only become publicly visible after DrinksHarbour approval.
        </Callout>
      </>
    ),
  },

  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    icon: Icon.PiProhibitBold,
    Body: () => (
      <>
        <P>When using the Services, you agree not to:</P>
        <BulletList items={[
          'Use the Services for any unlawful, fraudulent, or harmful purpose',
          'Purchase alcohol for or resell to a person under 18',
          'Interfere with, disrupt, or attempt to gain unauthorised access to the Platform, other accounts, or Merchant systems',
          'Scrape, harvest, or copy catalogue or user data except as expressly permitted',
          'Upload malicious code, spam, or infringing, offensive, or deceptive content',
          'Circumvent security, rate limits, tenant isolation, or payment controls',
          'Misrepresent your identity or impersonate any person or business',
        ]} />
        <P>We may investigate and take action — including suspension, removal of content, or referral to authorities — for any breach.</P>
      </>
    ),
  },
];
