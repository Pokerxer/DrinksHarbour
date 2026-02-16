// @ts-nocheck
import CreateEditProduct from '@/app/shared/ecommerce/product/create-edit';

export default async function EditProductPage({ params }: { params: { slug: string } }) {
  const slug = (await params).slug;

  return <CreateEditProduct slug={slug} id={slug} />;
}
