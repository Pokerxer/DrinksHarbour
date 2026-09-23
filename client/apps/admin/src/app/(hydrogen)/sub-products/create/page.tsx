import SubProductCreateEntry from '@/app/shared/ecommerce/sub-product/create-edit/create-entry';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Add Sub-Product'),
};

export default function CreateSubProductPage() {
  return (
    <>
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <SubProductCreateEntry />
      </div>
    </>
  );
}
