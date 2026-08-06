import AppraisalsNavHeader from '@/app/shared/appraisals/appraisals-nav-header';

/**
 * Shared chrome for every /appraisals/* route (overview, team, cycles,
 * templates, and their detail pages) — the appraisals section nav header,
 * mirroring the point-of-sale and support sections.
 *
 * The negative margins break out of the (hydrogen) content padding so the
 * white nav bar reaches the container edges; the inner wrapper restores
 * horizontal padding for the nav itself. Child pages keep their own
 * `px-6 py-8 md:px-10 lg:px-14` content padding, so no padding is added here.
 */
export default function AppraisalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <AppraisalsNavHeader />
      </div>
      {children}
    </div>
  );
}
