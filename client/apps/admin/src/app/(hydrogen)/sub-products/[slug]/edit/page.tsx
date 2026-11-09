// The sub-products layout renders the module chrome (Sub-Products nav) for
// every route in this group — pages must not stack another header on top of
// it (that read as two headers stacked: Marketplace + Sub-Products).
import SubProductCreateEdit from '@/app/shared/ecommerce/sub-product/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Edit Sub-Product'),
};

export default async function EditSubProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <>
      <div className="mt-4">
        <SubProductCreateEdit slug={slug} id={slug} />
      </div>
    </>
  );
}
