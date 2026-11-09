// The sub-products layout renders the module chrome (Sub-Products nav) for
// every route in this group — pages must not stack another header on top of
// it (that read as two headers stacked: Marketplace + Sub-Products).
import SubProductDetails from '@/app/shared/ecommerce/sub-product/product-details';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Sub Product Details'),
};

export default function SubProductDetailsPage() {
  return (
    <>
      <div className="mt-4">
        <SubProductDetails />
      </div>
    </>
  );
}
