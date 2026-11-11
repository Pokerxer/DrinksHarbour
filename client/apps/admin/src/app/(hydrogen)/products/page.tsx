// @ts-nocheck
import ProductsTable from '@/app/shared/ecommerce/product/product-list/table';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Products'),
};

export default function ProductsPage() {
  return (
    <>
      <div className="mt-4">
        <ProductsTable pageSize={80} />
      </div>
    </>
  );
}
