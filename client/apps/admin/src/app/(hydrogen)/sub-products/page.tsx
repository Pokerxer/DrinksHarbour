// @ts-nocheck
import SubProductsTable from '@/app/shared/ecommerce/sub-product/sub-product-list/table';
import { metaObject } from '@/config/site.config';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { DEFAULT_SUBPRODUCT_PAGE_SIZE } from '@/utils/sub-product-pagination';

export const metadata = {
  ...metaObject('Sub-Products'),
};

export default async function SubProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const params = await searchParams;
  const fromPOS = params.from === 'pos';

  return (
    <>
      {fromPOS ? (
        // The layout's content canvas insets by px-4 md:px-10 lg:px-14; this
        // re-expands to the full-bleed chrome line and re-applies the
        // hydrogen-level inset so POSNavHeader lines up like every other
        // module nav row (ModuleNavHeader for this group is hidden by the
        // layout gate while ?from=pos is set — never two headers).
        <div className="-mx-4 md:-mx-10 lg:-mx-14">
          <div className="px-4 md:px-5 lg:px-6 3xl:px-8">
            <POSNavHeader />
          </div>
        </div>
      ) : (
        <EcommercePageHeader hideHero />
      )}
      <div className={fromPOS ? '' : 'mt-4'}>
        <SubProductsTable pageSize={DEFAULT_SUBPRODUCT_PAGE_SIZE} />
      </div>
    </>
  );
}
