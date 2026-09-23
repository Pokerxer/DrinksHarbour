import SubProductDetails from '@/app/shared/ecommerce/sub-product/product-details';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Sub Product Details'),
};

export default function SubProductDetailsPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <SubProductDetails />
      </div>
    </>
  );
}
