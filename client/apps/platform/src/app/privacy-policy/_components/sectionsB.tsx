import React from 'react';
import * as Icon from 'react-icons/pi';
import {
  P, SubHeading, BulletList, Callout, DataTable, MailLink,
} from './ui';
import type { PolicySectionDef } from './sectionsA';

// ═══════════════════════════════════════════════════════════════════════════════
// PART B — Security, breach, retention, rights, alcohol, marketing, changes, contact
// ═══════════════════════════════════════════════════════════════════════════════

export const SECTIONS_B: PolicySectionDef[] = [
  {
    id: 'data-security',
    title: 'Data Security',
    icon: Icon.PiShieldCheckBold,
    Body: () => (
      <>
        <P>We apply industry-standard technical and organisational measures to protect your data, including:</P>
        <BulletList items={[
          'All data in transit is encrypted with TLS 1.2 or higher (HTTPS)',
          'Passwords are hashed with bcrypt — we never store plain-text passwords',
          'Payment card data is tokenised by Korapay and Paystack and never touches our servers',
          'Tenant isolation — each Merchant’s data is scoped and access-controlled so businesses cannot see one another’s customer or operational data',
          'Access to production systems is restricted to authorised personnel and protected by multi-factor authentication',
          'Privileged actions are recorded in tamper-evident audit logs',
          'Regular security reviews, dependency vulnerability scanning, and encrypted, off-site backups',
        ]} />
        <Callout tone="danger">
          No method of transmission or storage is completely secure. While we work hard to protect your
          data, we cannot guarantee absolute security. If you suspect unauthorised access to your
          account, contact us immediately at <MailLink email="security@drinksharbour.com" />.
        </Callout>
      </>
    ),
  },

  {
    id: 'breach-notification',
    title: 'Data Breach Notification',
    icon: Icon.PiSirenBold,
    Body: () => (
      <>
        <P>
          We maintain procedures to detect, contain, and investigate personal-data breaches. In the
          event of a breach likely to result in a risk to your rights and freedoms, we will:
        </P>
        <BulletList items={[
          'Notify the Nigeria Data Protection Commission (NDPC) without undue delay and, where feasible, within 72 hours of becoming aware of it',
          'Inform affected users promptly where the breach is likely to result in a high risk to them',
          'Describe the nature of the breach, likely consequences, and the steps we are taking to address it',
          'Document all breaches and our response for accountability',
        ]} />
      </>
    ),
  },

  {
    id: 'data-retention',
    title: 'Data Retention',
    icon: Icon.PiClockBold,
    Body: () => (
      <>
        <P>We keep personal data only for as long as necessary for the purposes it was collected, then delete or anonymise it:</P>
        <DataTable
          columns={['Data', 'Retention period']}
          rows={[
            ['Account data', 'While your account is active'],
            ['Order & transaction records', '7 years (Nigerian tax & accounting law)'],
            ['Support & contact messages', '2 years'],
            ['Marketing preferences', 'Until you unsubscribe or delete your account'],
            ['Audit logs of privileged actions', 'Up to 7 years'],
            ['Analytics data', 'Anonymised after 90 days'],
            ['Deleted accounts', 'Personal identifiers purged within 30 days; anonymised records may be retained for legal compliance'],
          ]}
        />
      </>
    ),
  },

  {
    id: 'your-rights',
    title: 'Your Rights',
    icon: Icon.PiUserBold,
    Body: () => (
      <>
        <P>Under the NDPA and NDPR, and subject to certain conditions, you have the right to:</P>
        <BulletList items={[
          <><strong>Access</strong> — request a copy of the personal data we hold about you</>,
          <><strong>Rectification</strong> — ask us to correct inaccurate or incomplete data</>,
          <><strong>Erasure</strong> — request deletion of your data, subject to our legal obligations</>,
          <><strong>Portability</strong> — receive your data in a structured, machine-readable format</>,
          <><strong>Objection</strong> — object to processing for direct marketing at any time, and to other processing based on legitimate interests</>,
          <><strong>Restriction</strong> — ask us to restrict processing while a dispute is resolved</>,
          <><strong>Withdraw consent</strong> — where processing relies on consent, withdraw it at any time</>,
          <><strong>Lodge a complaint</strong> — complain to the Nigeria Data Protection Commission (NDPC) if you believe your rights have been infringed</>,
        ]} />
        <P>
          To exercise any of these rights, email <MailLink email="privacy@drinksharbour.com" />. We will
          respond within 30 days and may need to verify your identity before acting on your request.
          Requests routed to a Merchant&rsquo;s own storefront data may be forwarded to that Merchant as
          the relevant controller.
        </P>
      </>
    ),
  },

  {
    id: 'age-alcohol',
    title: 'Age Restriction & Children’s Privacy',
    icon: Icon.PiWineBold,
    Body: () => (
      <>
        <P>
          DrinksHarbour sells alcoholic beverages. Our Services are strictly for users aged{' '}
          <strong className="text-gray-800">18 years and older</strong>. We apply an age-verification
          gate on alcohol purchases and may request proof of age at checkout or on delivery.
        </P>
        <P>
          We do not knowingly collect personal data from anyone under 18. If we learn that a minor has
          provided us with personal data, we will delete it promptly. If you believe a minor has
          submitted data to us, contact <MailLink email="privacy@drinksharbour.com" />.
        </P>
      </>
    ),
  },

  {
    id: 'marketing',
    title: 'Marketing & Communications',
    icon: Icon.PiBellRingingBold,
    Body: () => (
      <>
        <P>We may send you marketing only where you have opted in or where permitted by law. You are always in control:</P>
        <BulletList items={[
          'Unsubscribe from marketing emails using the link in any message',
          'Adjust notification and marketing preferences in your account settings',
          'Opt out of personalised offers while continuing to receive essential service messages',
        ]} />
        <P>
          Transactional messages (order confirmations, delivery updates, security and account notices)
          are part of the Services and are not marketing — you will continue to receive these while you
          hold an account.
        </P>
      </>
    ),
  },

  {
    id: 'merchant-data',
    title: 'Merchant & Storefront Data',
    icon: Icon.PiStorefrontBold,
    Body: () => (
      <>
        <P>
          Because DrinksHarbour is a multi-tenant platform, some data is handled by the independent
          Merchant you buy from rather than by us:
        </P>
        <BulletList items={[
          'When a Merchant fulfils your order, it acts as an independent controller of the order data we pass to it and is responsible for its own lawful handling of that data',
          'A Merchant’s own branded storefront or in-store systems may collect additional data under its own privacy notice',
          'We provide Merchants with business tools (inventory, invoicing, POS, CRM) and process the related data as their service provider under contract',
          'We keep Merchants’ customer and operational data isolated from one another',
        ]} />
        <P>
          If you are unsure who controls specific data, contact us and we will help identify the right
          controller.
        </P>
      </>
    ),
  },

  {
    id: 'third-party',
    title: 'Third-Party Links',
    icon: Icon.PiLinkBold,
    Body: () => (
      <>
        <P>
          Our Services may contain links to third-party websites — including Merchant social pages,
          payment processors, and blog references. These sites have their own privacy policies, and we
          are not responsible for their content or practices.
        </P>
        <P>We encourage you to review the privacy policy of any third-party site you visit via a link on DrinksHarbour.</P>
      </>
    ),
  },

  {
    id: 'changes',
    title: 'Changes to This Policy',
    icon: Icon.PiNotePencilBold,
    Body: () => (
      <>
        <P>We may update this Privacy Policy from time to time. When we make material changes, we will notify you by:</P>
        <BulletList items={[
          'Posting a prominent notice on our website',
          'Emailing your registered address at least 14 days before the changes take effect',
          'Updating the “Last updated” date at the top of this page',
        ]} />
        <P>
          Continued use of DrinksHarbour after the effective date of any change constitutes acceptance
          of the updated Policy. Where a change requires it, we will ask for your fresh consent.
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
        <P>For privacy enquiries, data-access requests, or to report a concern, contact our Data Protection Officer:</P>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          {([
            { icon: Icon.PiBuildings, label: 'DrinksHarbour Technologies Ltd' },
            { icon: Icon.PiMapPin,     label: 'Abuja, Federal Capital Territory, Nigeria' },
            { icon: Icon.PiEnvelope,   label: 'privacy@drinksharbour.com', href: 'mailto:privacy@drinksharbour.com' },
            { icon: Icon.PiShieldCheck, label: 'security@drinksharbour.com', href: 'mailto:security@drinksharbour.com' },
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
        <P>
          You also have the right to lodge a complaint with the{' '}
          <strong className="text-gray-800">Nigeria Data Protection Commission (NDPC)</strong> if you
          believe we have not handled your data lawfully. We aim to respond to all privacy requests
          within <strong className="text-gray-800">30 days</strong>.
        </P>
      </>
    ),
  },
];
