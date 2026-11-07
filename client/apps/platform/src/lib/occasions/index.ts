import type { CommercialPage } from '@/lib/commercialPages';
import type { SubpageDoc } from './types';
import { weddingsSubpages } from './weddings';
import { corporateSubpages } from './corporate';
import { housePartiesSubpages } from './house-parties';
import { giftingSubpages } from './gifting';

const REGISTRY: Record<string, SubpageDoc[]> = {
  weddings: weddingsSubpages,
  corporate: corporateSubpages,
  'house-parties': housePartiesSubpages,
  gifting: giftingSubpages,
};

export function getOccasionSubpages(occasion: string): SubpageDoc[] {
  return REGISTRY[occasion] ?? [];
}

export function getOccasionSubpage(occasion: string, subpage: string): SubpageDoc | undefined {
  return getOccasionSubpages(occasion).find(entry => entry.slug === subpage);
}

/** Map a subpage onto the shared CommercialGuide shape for consistent styling. */
export function subpageToPage(page: CommercialPage, sub: SubpageDoc): CommercialPage {
  return {
    ...page,
    path: `${page.path}/${sub.slug}`,
    label: sub.title,
    title: sub.title,
    heading: sub.heading,
    description: sub.description,
    intro: sub.intro,
    sections: sub.sections,
    checklist: sub.checklist,
    shelves: sub.shelves,
    facts: sub.facts,
  };
}
