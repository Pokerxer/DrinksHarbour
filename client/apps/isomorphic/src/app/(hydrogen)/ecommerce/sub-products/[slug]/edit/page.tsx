// @ts-nocheck
import SubProductCreateEdit from '@/app/shared/ecommerce/sub-product/create-edit';

export default async function EditSubProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return <SubProductCreateEdit slug={slug} id={slug} />;
}
