// @ts-nocheck
import CreateEditProduct from '@/app/shared/ecommerce/product/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Add Product'),
};

export default function CreateProductPage() {
  return (
    <>
      <div className="mt-4">
        <CreateEditProduct />
      </div>
    </>
  );
}
