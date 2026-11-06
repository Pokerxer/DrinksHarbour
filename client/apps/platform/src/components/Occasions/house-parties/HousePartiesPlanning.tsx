import type { CommercialPage } from '@/lib/commercialPages';
import HousePartyTools from './HousePartyTools';
import SubpageInCopyLinks from '../planning/SubpageInCopyLinks';

type PlanningSection = { heading: string; text: string; links?: { href: string; label: string }[] };

const sections: PlanningSection[] = [
  {
    heading: 'Serve a short menu instead of a full bar',
    text: 'Most house parties run best on three lanes: cold beer or cans for the crowd, one or two cocktails mixed from a chosen spirit, and water plus soft drinks for everyone. Decide those lanes before you shop, work out the bottles behind each one with the tools here, and skip anything you cannot name a use for. Chill a first round ahead of your guests so nobody waits.',
    links: [
      { href: '/occasions/house-parties/cocktails', label: 'cocktails guide' },
      { href: '/occasions/house-parties/birthday', label: 'birthday guide' },
    ],
  },
  {
    heading: 'What the order does and does not include',
    text: 'An enquiry adds the bottles you ask about — quantities, ice, cups, chilling, garnishes, glassware and anyone to serve or mix drinks are not included unless you arrange them with our team separately. Keep each bottle’s storage guidance in mind: most wines and bitters are fine in a cool room until the day, juice and mixers need fridge or cooler space, and beer should be chilled well before serving.',
  },
  {
    heading: 'Order with time to receive it',
    text: 'Send the list once your gathering date and address are fixed. Confirm your address’s delivery options before payment — same-day delivery depends on your location and the time you order, and is never guaranteed. Alcohol is sold to adults aged 18 and over, so plan an adult to receive it, and aim for your guests to drink responsibly, with a plan that gets drivers home safely.',
  },
];

/** Story content for the CommercialGuide body slot. */
export function HousePartiesPlanningBody({ page }: { page: CommercialPage }) {
  void page;
  return <div className="space-y-8">
    {sections.map(section => <section key={section.heading}>
      <h2 className="text-2xl font-bold">{section.heading}</h2>
      <p className="mt-3 leading-7 text-gray-700">{section.text}{section.links?.length ? <SubpageInCopyLinks lead="Dedicated planning guides:" links={section.links} /> : null}</p>
    </section>)}
  </div>;
}

/** Interactive tools for the CommercialGuide full-width below slot. */
export function HousePartiesPlanningBelow() {
  return <HousePartyTools />;
}

/**
 * Composed render kept for existing tests: story + tools together. The parent
 * route mounts the story and below slots separately. Server-safe: no site
 * hero, breadcrumbs, guide shell, request form or SubpageNav.
 */
export default function HousePartiesPlanning({ page }: { page: CommercialPage }) {
  void page;
  return <div className="space-y-10">
    <div className="space-y-8"><HousePartiesPlanningBody page={page} /></div>
    <HousePartiesPlanningBelow />
  </div>;
}
