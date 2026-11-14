import Link from 'next/link';
import GiftChecklist from './GiftChecklist';
import GiftFinder from './GiftFinder';
import GiftingToolkit from './GiftingToolkit';
import OccasionShelf from '../planning/OccasionShelf';

const LINK_STYLE = 'font-semibold text-[#7c1d1d] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]';

function PlanningSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return <section>
    <h2 className="text-2xl font-bold text-gray-900">{heading}</h2>
    <div className="mt-3 space-y-3 leading-7 text-gray-700">{children}</div>
  </section>;
}

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return <li><strong className="font-semibold text-gray-900">{title}</strong> — {children}</li>;
}

/**
 * Gifting body content mounted between the CommercialGuide hero and the
 * staff-review request form. Deliberately excludes the hero, breadcrumbs,
 * OccasionChatPlanner and SubpageNav — the parent route owns those. All tools
 * here are deterministic: no AI, no prices, quantities and categories only.
 */
/** Story for the CommercialGuide body slot: gift thinking plus its tools. */
export function GiftingPlanningBody() {
  return <div className="space-y-8">
    <PlanningSection heading="Match the gift to the recipient">
      <p>
        A drinks gift lands well when it starts from the recipient, not from the bottle you happen to like. Confirm three things first: the styles they enjoy, whether they drink alcohol at all — some recipients avoid it for health or religious reasons — and whether alcohol is appropriate at all in your relationship and setting. If you are buying for a whole team, the <Link href="/occasions/gifting/corporate-gifts" className={LINK_STYLE}>corporate drinks gifts guide</Link> gathers the policy, recipient and logistics questions in one place.
      </p>
      <GiftFinder />
    </PlanningSection>

    <PlanningSection heading="Check the packaging explicitly">
      <p>
        Gift packaging is an optional add-on when available. Check the price in your cart. For a particular box, ribbon or hamper, confirm the presentation and any substitutions with the team before paying. For a multi-bottle gift delivery, the <Link href="/occasions/gifting/hampers" className={LINK_STYLE}>hamper guide</Link> walks through packaging, substitutions and handover care.
      </p>
      <ul className="list-disc space-y-2 pl-5 text-gray-700">
        <Bullet title="Gift box or hamper">only when confirmed for the specific order.</Bullet>
        <Bullet title="Gift message">add your wording in the cart or at checkout.</Bullet>
        <Bullet title="Substitutions">agree acceptable swaps in writing so no unchosen bottle arrives.</Bullet>
      </ul>
      <GiftChecklist />
    </PlanningSection>

    <PlanningSection heading="Plan the handover">
      <p>
        Confirm the recipient’s address, phone contact and availability so the delivery can be arranged around them, not the courier’s convenience. Every alcoholic gift must be received in person by an adult aged 18 or over at the address. Share the celebration date early so the team can advise on a realistic window: a requested celebration date is a plan, not a guaranteed arrival date, so leave time to spare.
      </p>
    </PlanningSection>
  </div>;
}

/** Interactive tools for the CommercialGuide full-width below slot: the tabbed
 * gifting toolkit (hamper builder, recipients, budget tiers, messages) behind
 * one panel set with a shared suggestion summary, then the catalogue shelf.
 * All deterministic — no AI, no client-side price math. */
export function GiftingPlanningBelow() {
  return <div className="space-y-10">
    <GiftingToolkit />
    <OccasionShelf label="Champagne gifts for honourees" category="champagne" limit={6}
      emptyHint="Champagne could not load right now. Browse the shop or ask support about current celebratory bottles." />
  </div>;
}

/**
 * Composed render kept for existing tests: story + below together. The parent
 * route mounts the story and below slots separately. Deliberately excludes the
 * hero, breadcrumbs, OccasionChatPlanner and SubpageNav — the parent route owns
 * those. All tools here are deterministic: no AI, no prices, quantities and
 * categories only.
 */
export default function GiftingPlanning() {
  return <div className="space-y-8">
    <GiftingPlanningBody />
    <GiftingPlanningBelow />
  </div>;
}
