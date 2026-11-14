import type { CommercialPage } from '@/lib/commercialPages';
import GuideStructuredData from '@/components/CommerceGuides/GuideStructuredData';
import SubpageNav from '@/components/Occasions/planning/SubpageNav';
import { getOccasionSubpages } from '@/lib/occasions';
import WeddingHero from './WeddingHero';
import WeddingPlanner from './WeddingPlanner';
import WeddingHelp from './WeddingHelp';
import WeddingShopping, { weddingCollections } from './WeddingShopping';
import type { Offer } from '@/components/Merchandising/offers';

export default function WeddingPage({ page, offers = [] }: { page: CommercialPage; offers?: Offer[] }) {
  const subpages = getOccasionSubpages(page.slug).map(entry => ({ slug: entry.slug, title: entry.title }));
  return <article className="bg-[#fcfaf8] text-gray-900">
    <GuideStructuredData path={page.path} name={page.heading} description={page.description}
      collectionItems={weddingCollections.map(({ name, href }) => ({ name, url: href }))} />
    <WeddingHero page={page} />
    <WeddingShopping offers={offers} />
    <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8 lg:pt-10"><SubpageNav occasionPath={page.path} occasionLabel="Weddings" planHref="#wedding-list" subpages={subpages} /></div>
    <WeddingPlanner /><WeddingHelp page={page} />
  </article>;
}
