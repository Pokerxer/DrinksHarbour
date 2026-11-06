import type { CommercialPage } from '@/lib/commercialPages';
import { corporateEventCalc } from './calcConfig';
import CorporatePlanningTools from './CorporatePlanningTools';
import { planningSections, type PlanningSection } from './sections';
import SubpageInCopyLinks from '../planning/SubpageInCopyLinks';

/** Story content for the CommercialGuide body slot. No tools, no request form. */
export function CorporatePlanningBody({ page }: { page: CommercialPage }) {
  void page;
  return <div className="space-y-8">
    {planningSections.map(section => <section key={section.heading}>
      <h2 className="text-2xl font-bold">{section.heading}</h2>
      <p className="mt-3 leading-7 text-gray-700">{section.text}{section.links?.length ? <SubpageInCopyLinks lead="Both sides have a dedicated guide:" links={section.links} /> : null}</p>
    </section>)}
  </div>;
}

/** Interactive tools for the CommercialGuide full-width below slot. */
export function CorporatePlanningBelow() {
  return <CorporatePlanningTools calc={corporateEventCalc} />;
}

/**
 * Composed render kept for existing tests: story + tools together. The parent
 * route mounts the story and below slots separately. Server-safe; no hero,
 * breadcrumbs, guide shell, request form or SubpageNav; no customer-facing AI.
 */
export default function CorporatePlanning({ page }: { page: CommercialPage }) {
  if (page.slug !== 'corporate') return null;
  return <div className="space-y-8">
    <CorporatePlanningBody page={page} />
    <CorporatePlanningBelow />
  </div>;
}
