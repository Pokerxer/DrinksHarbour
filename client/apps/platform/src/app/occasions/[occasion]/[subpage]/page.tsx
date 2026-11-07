import { notFound } from 'next/navigation';
import { getOccasionPage, occasionPages } from '@/lib/commercialPages';
import { getOccasionSubpage, getOccasionSubpages, subpageToPage } from '@/lib/occasions';
import { guideMetadata } from '@/components/CommerceGuides/GuideMetadata';
import CommercialGuide from '@/components/CommerceGuides/CommercialGuide';
import SubpageNav from '@/components/Occasions/planning/SubpageNav';

type Props = { params: Promise<{ occasion: string; subpage: string }> };

export function generateStaticParams() {
  return occasionPages.flatMap(page => getOccasionSubpages(page.slug).map(sub => ({ occasion: page.slug, subpage: sub.slug })));
}

export async function generateMetadata({ params }: Props) {
  const { occasion, subpage } = await params;
  const page = getOccasionPage(occasion);
  const sub = page && getOccasionSubpage(page.slug, subpage);
  return sub ? guideMetadata(`${page!.path}/${sub.slug}`, sub.title, sub.description)
    : { title: 'Occasion page not found', robots: { index: false, follow: false } };
}

export default async function OccasionSubpagePage({ params }: Props) {
  const { occasion, subpage } = await params;
  const page = getOccasionPage(occasion);
  const sub = page && getOccasionSubpage(page.slug, subpage);
  if (!page || !sub) notFound();
  return <CommercialGuide page={subpageToPage(page, sub)}>
    <SubpageNav occasionPath={page.path} occasionLabel={page.label} activeSlug={sub.slug}
      subpages={getOccasionSubpages(page.slug).map(entry => ({ slug: entry.slug, title: entry.title }))} />
  </CommercialGuide>;
}
