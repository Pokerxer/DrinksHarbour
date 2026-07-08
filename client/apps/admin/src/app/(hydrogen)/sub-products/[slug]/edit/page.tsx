// @ts-nocheck
import SubProductCreateEdit from '@/app/shared/ecommerce/sub-product/create-edit';
import EcommercePageHeader from '@/app/shared/ecommerce/ecommerce-page-header';
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
      <EcommercePageHeader hideHero />
      <div className="mt-4">
        <SubProductCreateEdit slug={slug} id={slug} />
      </div>
    </>
  );
}
