// @ts-nocheck
import CreateEditProduct from '@/app/shared/ecommerce/product/create-edit';

export default async function EditProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return <CreateEditProduct slug={slug} id={slug} />;
}
