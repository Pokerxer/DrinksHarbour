import { notFound } from 'next/navigation';
import { getOccasionPage, occasionPages } from '@/lib/commercialPages';
import { getOccasionSubpages } from '@/lib/occasions';
import CommercialGuide from '@/components/CommerceGuides/CommercialGuide';
import OccasionChatPlanner from '@/components/Occasions/OccasionChatPlanner';
import WeddingPage from '@/components/Weddings/WeddingPage';
import { CorporatePlanningBody, CorporatePlanningBelow } from '@/components/Occasions/corporate/CorporatePlanning';
import { HousePartiesPlanningBody, HousePartiesPlanningBelow } from '@/components/Occasions/house-parties/HousePartiesPlanning';
import { GiftingPlanningBody, GiftingPlanningBelow } from '@/components/Occasions/gifting/GiftingPlanning';
import SubpageNav from '@/components/Occasions/planning/SubpageNav';
import OccasionDrinksProvider from '@/components/Occasions/planning/OccasionDrinksContext';
import OccasionCtaBand from '@/components/Occasions/planning/OccasionCtaBand';
import { guideMetadata } from '@/components/CommerceGuides/GuideMetadata';

type Props = { params: Promise<{ occasion: string }> };

export function generateStaticParams() {
  return occasionPages.map(page => ({ occasion: page.slug }));
}

export async function generateMetadata({ params }: Props) {
  const page = getOccasionPage((await params).occasion);
  return page ? guideMetadata(page.path, page.title, page.description) : { title: 'Occasion not found', robots: { index: false, follow: false } };
}

export default async function OccasionPage({ params }: Props) {
  const page = getOccasionPage((await params).occasion);
  if (!page) notFound();
  const subpages = getOccasionSubpages(page.slug).map(entry => ({ slug: entry.slug, title: entry.title }));
  const nav = <SubpageNav occasionPath={page.path} occasionLabel={page.label} subpages={subpages} />;
  const slots: Partial<Record<typeof page.slug, [React.ReactNode, React.ReactNode]>> = {
    corporate: [<CorporatePlanningBody key="s" page={page} />, <CorporatePlanningBelow key="t" />],
    'house-parties': [<HousePartiesPlanningBody key="s" page={page} />, <HousePartiesPlanningBelow key="t" />],
    gifting: [<GiftingPlanningBody key="s" page={page} />, <GiftingPlanningBelow key="t" />],
  };
  const slot = slots[page.slug];
  return page.slug === 'weddings' ? <WeddingPage page={page} /> : <CommercialGuide page={page} body={slot?.[0]} below={slot && <OccasionDrinksProvider draftKey={page.slug}><div className="mb-12">{slot[1]}</div><OccasionCtaBand /><OccasionChatPlanner occasion={page.slug} embedded /></OccasionDrinksProvider>}>
    {nav}
    {!slot && <>
      <OccasionChatPlanner occasion={page.slug} />
      <OccasionCtaBand heading="Ready to send your brief?" note="Your details go to our planning team — a human replies by email or WhatsApp. About 30 minutes aim; no stock reserved and no order placed." />
    </>}
  </CommercialGuide>;
}
