import CatalogNavHeader from '@/app/shared/ecommerce/catalog-nav-header';

/**
 * Shared chrome for every /categories/* route — the catalog nav header,
 * mirroring the support/POS pages. Negative margins break out of the
 * (hydrogen) content padding so the white nav bar reaches the container
 * edges; the inner wrapper restores horizontal padding for the nav itself.
 */
export default function CategoriesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-mx-4 -mt-2 flex flex-col md:-mx-5 lg:-mx-6 3xl:-mx-8">
      <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
        <CatalogNavHeader />
      </div>
      <div className="flex-1 px-6 pb-12 pt-6 md:px-10 lg:px-12">{children}</div>
    </div>
  );
}
