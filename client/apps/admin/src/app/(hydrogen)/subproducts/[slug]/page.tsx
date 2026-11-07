import { redirect } from 'next/navigation';

export default async function SubproductAlias({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/sub-products/${encodeURIComponent(slug)}`);
}
