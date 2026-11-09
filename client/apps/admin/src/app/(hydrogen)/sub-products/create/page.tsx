// The sub-products layout renders the module chrome (Sub-Products nav) for
// every route in this group — pages must not stack another header on top of
// it (that read as two headers stacked: Marketplace + Sub-Products).
import SubProductCreateEntry from '@/app/shared/ecommerce/sub-product/create-edit/create-entry';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Add Sub-Product'),
};

export default function CreateSubProductPage() {
  return (
    <>
      <div className="mt-4">
        <SubProductCreateEntry />
      </div>
    </>
  );
}
