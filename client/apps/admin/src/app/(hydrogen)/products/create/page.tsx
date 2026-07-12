// @ts-nocheck
import CreateEditProduct from '@/app/shared/ecommerce/product/create-edit';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Add Product'),
};

export default function CreateProductPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <CreateEditProduct />
      </div>
    </>
  );
}
