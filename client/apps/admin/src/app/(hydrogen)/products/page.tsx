// @ts-nocheck
import ProductsTable from '@/app/shared/ecommerce/product/product-list/table';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Products'),
};

export default function ProductsPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <ProductsTable pageSize={80} />
      </div>
    </>
  );
}
