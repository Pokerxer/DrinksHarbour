import React from 'react';
import * as Icon from 'react-icons/pi';
import {
  P, BulletList, Callout, MailLink,
  type PolicySectionDef,
} from '@/components/legal/ui';

// ═══════════════════════════════════════════════════════════════════════════════
// PART B — Content, IP, alcohol, third parties, disclaimers, liability,
//          indemnity, termination, governing law, changes, contact
// ═══════════════════════════════════════════════════════════════════════════════

export const TERMS_B: PolicySectionDef[] = [
  {
    id: 'user-content',
    title: 'User Content & Reviews',
    icon: Icon.PiChatCircleTextBold,
    Body: () => (
      <>
        <P>You may submit content such as reviews, ratings, and messages (&ldquo;User Content&rdquo;). You are responsible for what you submit and confirm you have the right to share it.</P>
        <BulletList items={[
          'By posting User Content, you grant DrinksHarbour a non-exclusive, worldwide, royalty-free licence to host, display, and use it to operate and promote the Services',
          'User Content must be honest, lawful, and free of offensive, misleading, or infringing material',
          'We may moderate, edit, or remove User Content, and may use automated tools to detect spam and analyse review sentiment',
          'Reviews should reflect genuine experience; incentivised or fake reviews are not permitted',
        ]} />
      </>
    ),
  },

  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    icon: Icon.PiCopyrightBold,
    Body: () => (
      <>
        <P>
          The Platform, including its software, design, logos, text, and graphics, is owned by
          DrinksHarbour or its licensors and is protected by intellectual-property laws. Merchant and
          brand trademarks remain the property of their respective owners.
        </P>
        <P>
          We grant you a limited, non-exclusive, non-transferable licence to access and use the
          Services for their intended purpose. You may not copy, modify, distribute, or create
          derivative works from the Platform without our written permission.
        </P>
      </>
    ),
  },

  {
    id: 'responsible-drinking',
    title: 'Alcohol & Responsible Drinking',
    icon: Icon.PiBeerBottleBold,
    Body: () => (
      <>
        <P>
          DrinksHarbour promotes the responsible enjoyment of alcohol. Alcohol can be harmful if
          misused. We do not encourage excessive or underage consumption, and we reserve the right to
          limit quantities or refuse service.
        </P>
        <BulletList items={[
          'Do not drink and drive',
          'Alcohol is not recommended during pregnancy',
          'Seek help if you or someone you know is affected by alcohol misuse',
        ]} />
      </>
    ),
  },

  {
    id: 'third-parties',
    title: 'Third-Party Services & Links',
    icon: Icon.PiLinkBold,
    Body: () => (
      <>
        <P>
          The Services rely on and link to third parties — including payment processors (Korapay,
          Paystack), logistics partners, and external websites. We are not responsible for the content,
          policies, or practices of third-party services, and your use of them may be subject to their
          own terms.
        </P>
      </>
    ),
  },

  {
    id: 'disclaimers',
    title: 'Disclaimers',
    icon: Icon.PiWarningBold,
    Body: () => (
      <>
        <P>
          The Services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To
          the fullest extent permitted by law, DrinksHarbour disclaims all warranties, express or
          implied, including fitness for a particular purpose and non-infringement.
        </P>
        <P>
          We do not warrant that the Services will be uninterrupted, error-free, or secure, or that
          catalogue information, pricing, or availability set by Merchants is always complete or
          accurate. Nothing in these Terms excludes liability that cannot be excluded under Nigerian law.
        </P>
      </>
    ),
  },

  {
    id: 'liability',
    title: 'Limitation of Liability',
    icon: Icon.PiShieldWarningBold,
    Body: () => (
      <>
        <P>To the fullest extent permitted by law:</P>
        <BulletList items={[
          'DrinksHarbour is not liable for indirect, incidental, special, or consequential losses, or for loss of profits, revenue, data, or goodwill',
          'Our total aggregate liability arising out of or relating to the Services is limited to the amount you paid to DrinksHarbour for the order or service giving rise to the claim in the 3 months before the event',
          'We are not liable for the acts or omissions of Merchants or third-party providers beyond our reasonable control',
        ]} />
        <Callout tone="warning">
          Some jurisdictions do not allow certain limitations; where that applies, our liability is
          limited to the greatest extent permitted by law.
        </Callout>
      </>
    ),
  },

  {
    id: 'indemnity',
    title: 'Indemnification',
    icon: Icon.PiScalesBold,
    Body: () => (
      <>
        <P>
          You agree to indemnify and hold harmless DrinksHarbour, its officers, employees, and partners
          from any claims, damages, losses, and expenses (including reasonable legal fees) arising from
          your breach of these Terms, your misuse of the Services, or your violation of any law or the
          rights of a third party.
        </P>
      </>
    ),
  },

  {
    id: 'termination',
    title: 'Suspension & Termination',
    icon: Icon.PiSignOutBold,
    Body: () => (
      <>
        <P>
          You may stop using the Services and close your account at any time. We may suspend or
          terminate your access, with or without notice, if:
        </P>
        <BulletList items={[
          'You breach these Terms or applicable law',
          'We are required to do so by law or a regulator',
          'Your account poses a security, fraud, or legal risk',
        ]} />
        <P>
          On termination, your right to use the Services ends immediately. Provisions that by their
          nature should survive — including payment obligations, intellectual property, disclaimers,
          liability limits, and indemnity — continue to apply.
        </P>
      </>
    ),
  },

  {
    id: 'governing-law',
    title: 'Governing Law & Disputes',
    icon: Icon.PiGavelBold,
    Body: () => (
      <>
        <P>
          These Terms are governed by the laws of the Federal Republic of Nigeria. You agree that the
          courts of the Federal Capital Territory, Abuja, have jurisdiction over any dispute, subject to
          any mandatory consumer-protection rights you may have.
        </P>
        <P>
          Before starting formal proceedings, we encourage you to contact us at{' '}
          <MailLink email="support@drinksharbour.com" /> so we can try to resolve the matter amicably.
        </P>
      </>
    ),
  },

  {
    id: 'changes',
    title: 'Changes to These Terms',
    icon: Icon.PiNotePencilBold,
    Body: () => (
      <>
        <P>
          We may update these Terms from time to time. When we make material changes, we will post the
          updated Terms with a new &ldquo;Last updated&rdquo; date and, where appropriate, notify you by
          email or on-site notice.
        </P>
        <P>Continued use of the Services after changes take effect constitutes acceptance of the updated Terms.</P>
      </>
    ),
  },

  {
    id: 'contact',
    title: 'Contact Us',
    icon: Icon.PiEnvelopeBold,
    Body: () => (
      <>
        <P>For questions about these Terms, contact us:</P>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
          {([
            { icon: Icon.PiBuildings, label: 'DrinksHarbour Technologies Ltd' },
            { icon: Icon.PiMapPin,     label: 'Abuja, Federal Capital Territory, Nigeria' },
            { icon: Icon.PiEnvelope,   label: 'support@drinksharbour.com', href: 'mailto:support@drinksharbour.com' },
            { icon: Icon.PiScales,     label: 'legal@drinksharbour.com', href: 'mailto:legal@drinksharbour.com' },
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
