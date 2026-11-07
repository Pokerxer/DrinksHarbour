import { redirect } from 'next/navigation';

export default async function SubproductsAlias({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  redirect(from === 'pos' ? '/sub-products?from=pos' : '/sub-products');
}
