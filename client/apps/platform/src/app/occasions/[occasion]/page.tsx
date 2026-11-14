import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getOccasionPage, occasionPages } from '@/lib/commercialPages';
import { getOccasionSubpages } from '@/lib/occasions';
import CommercialGuide from '@/components/CommerceGuides/CommercialGuide';
import OccasionChatPlanner from '@/components/Occasions/OccasionChatPlanner';
import WeddingPage from '@/components/Weddings/WeddingPage';
import { weddingHeroImage } from '@/components/Weddings/WeddingHero';
import { loadOccasionOffers } from '@/components/Occasions/planning/occasionOffers';
import { CorporatePlanningBody, CorporatePlanningBelow } from '@/components/Occasions/corporate/CorporatePlanning';
import { PartyStorefrontHero, PartyStorefrontShopping, partyCollections, partyHeroImage } from '@/components/Occasions/house-parties/PartyStorefront';
import { HousePartiesPlanningBody, HousePartiesPlanningBelow } from '@/components/Occasions/house-parties/HousePartiesPlanning';
import { GiftingPlanningBody, GiftingPlanningBelow } from '@/components/Occasions/gifting/GiftingPlanning';
import SubpageNav from '@/components/Occasions/planning/SubpageNav';
import OccasionDrinksProvider from '@/components/Occasions/planning/OccasionDrinksContext';
import OccasionCtaBand from '@/components/Occasions/planning/OccasionCtaBand';
import { guideMetadata } from '@/components/CommerceGuides/GuideMetadata';
import { withSocialMetadata } from '@/lib/socialMetadata';
import { GiftStorefrontHero, GiftStorefrontShopping, giftHeroImage } from '@/components/Occasions/gifting/GiftStorefront';
import { giftCollections, loadGiftOffers } from '@/components/Occasions/gifting/giftCatalogue';

type Props = { params: Promise<{ occasion: string }> };

export function generateStaticParams() {
  return occasionPages.map(page => ({ occasion: page.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = getOccasionPage((await params).occasion);
  if (!page) return { title: 'Occasion not found', robots: { index: false, follow: false } };
  const metadata = guideMetadata(page.path, page.title, page.description);
  const socialImages: Partial<Record<typeof page.slug, { url: string; alt: string }>> = {
    'house-parties': { url: partyHeroImage, alt: 'Iced drinks and a hibiscus pitcher on a house party table' },
    gifting: { url: giftHeroImage, alt: 'A bottle with a gift note and ribbon' },
    weddings: { url: weddingHeroImage, alt: 'Sparkling wine flutes on a wedding reception table' },
  };
  const image = socialImages[page.slug];
  if (!image) return metadata;
  return withSocialMetadata({
    ...metadata,
    openGraph: { ...metadata.openGraph, images: [image] },
    twitter: { ...metadata.twitter, card: 'summary_large_image', images: [image.url] },
  });
}

export default async function OccasionPage({ params }: Props) {
  const page = getOccasionPage((await params).occasion);
  if (!page) notFound();
  if (page.slug === 'weddings') {
    const offers = await loadOccasionOffers(['champagne', 'wine', 'non-alcoholic']);
    return <WeddingPage page={page} offers={offers} />;
  }
  const subpages = getOccasionSubpages(page.slug).map(entry => ({ slug: entry.slug, title: entry.title }));
  const nav = <SubpageNav occasionPath={page.path} occasionLabel={page.label} subpages={subpages} />;
  const slots: Partial<Record<typeof page.slug, [React.ReactNode, React.ReactNode]>> = {
    corporate: [<CorporatePlanningBody key="s" page={page} />, <CorporatePlanningBelow key="t" />],
    'house-parties': [<HousePartiesPlanningBody key="s" page={page} />, <HousePartiesPlanningBelow key="t" />],
    gifting: [<GiftingPlanningBody key="s" />, <GiftingPlanningBelow key="t" />],
  };
  const slot = slots[page.slug];
  const isGifting = page.slug === 'gifting';
  const isParty = page.slug === 'house-parties';
  const storefront = isParty ? {
    hero: <PartyStorefrontHero page={page} />,
    shopping: <PartyStorefrontShopping offers={await loadOccasionOffers(['beer', 'gin', 'non-alcoholic'])} />,
    collections: partyCollections,
  } : isGifting ? {
    hero: <GiftStorefrontHero page={page} />,
    shopping: <GiftStorefrontShopping offers={await loadGiftOffers()} />,
    collections: giftCollections,
  } : undefined;
  return <CommercialGuide page={page}
    hero={storefront?.hero}
    collectionItems={storefront?.collections.map(({ name, href }) => ({ name, url: href }))}
    body={slot?.[0]} below={slot && <OccasionDrinksProvider draftKey={page.slug}><div className="mb-12">{slot[1]}</div><OccasionCtaBand /><OccasionChatPlanner occasion={page.slug} embedded /></OccasionDrinksProvider>}>
    {storefront?.shopping}
    {nav}
    {!slot && <>
      <OccasionChatPlanner occasion={page.slug} />
      <OccasionCtaBand heading="Ready to send your brief?" note="Your details go to our planning team — a human replies by email or WhatsApp. About 30 minutes aim; no stock reserved and no order placed." />
    </>}
  </CommercialGuide>;
}
