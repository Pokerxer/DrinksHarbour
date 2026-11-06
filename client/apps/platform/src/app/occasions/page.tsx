import { guideMetadata } from '@/components/CommerceGuides/GuideMetadata';
import { occasionPages } from '@/lib/commercialPages';
import GuideStructuredData from '@/components/CommerceGuides/GuideStructuredData';
import OccasionsHero from '@/components/Occasions/OccasionsHero';
import OccasionsExplorer from '@/components/Occasions/OccasionsExplorer';
import OccasionsHelp from '@/components/Occasions/OccasionsHelp';

const title = 'Drinks for Weddings, Parties & Gifts in Nigeria';
const description = 'Plan drinks for weddings, corporate events, house parties and gifts in Nigeria. Explore bottle choices, bulk buying guidance and delivery information.';
export const metadata = guideMetadata('/occasions', title, description);

export default function OccasionsPage() {
  const collectionItems = occasionPages.map(page => ({ name: page.label, url: page.path }));
  return <article className="bg-[#fcfaf8] text-gray-900">
    <GuideStructuredData path="/occasions" name={title} description={description} collectionItems={collectionItems} />
    <OccasionsHero />
    <OccasionsExplorer />
    <OccasionsHelp />
  </article>;
}
