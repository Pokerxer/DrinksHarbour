// @ts-nocheck
import CreateEditProduct from '@/app/shared/ecommerce/product/create-edit';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Edit Product'),
};

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <>
      <div className="mt-4">
        <CreateEditProduct slug={slug} id={slug} />
      </div>
    </>
  );
}
