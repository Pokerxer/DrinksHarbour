'use client';

import WarehousesNavHeader from '@/app/shared/warehouses/warehouses-nav-header';

/**
 * Shared chrome for every /warehouses/* route. Hoisting the nav header here keeps
 * the warehouse header visible across all warehouse links (list, analysis, detail)
 * instead of each page re-rendering its own copy.
 *
 * The negative margins break out of the (hydrogen) content padding so the nav bar
 * and any full-bleed hero (e.g. the warehouses list) reach the container edges;
 * the inner wrapper restores horizontal padding for the nav itself.
 */
export default function WarehousesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex min-h-screen flex-col bg-[#FAF8F3] bg-[radial-gradient(ellipse_1100px_500px_at_50%_-10%,rgba(178,2,2,0.06),transparent)] md:-mx-5 lg:-mx-6 3xl:-mx-8 4xl:-mx-10">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8 4xl:px-10">
        <WarehousesNavHeader />
      </div>
      {children}
    </div>
  );
}
