// @ts-nocheck
import SubProductsTable from '@/app/shared/ecommerce/sub-product/sub-product-list/table';
import { metaObject } from '@/config/site.config';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';

export const metadata = {
  ...metaObject('Products'),
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
      {fromPOS && <POSNavHeader />}
      <SubProductsTable pageSize={10} />
    </>
  );
}
