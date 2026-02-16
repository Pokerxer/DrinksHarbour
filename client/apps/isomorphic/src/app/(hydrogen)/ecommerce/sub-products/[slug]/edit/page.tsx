// @ts-nocheck
import SubProductCreateEdit from '@/app/shared/ecommerce/sub-product/create-edit';

export default async function EditSubProductPage({ params }: { params: { slug: string } }) {
  const slug = (await params).slug;

  return <SubProductCreateEdit slug={slug} id={slug} />;
}
