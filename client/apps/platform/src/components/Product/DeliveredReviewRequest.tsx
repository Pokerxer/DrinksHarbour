import Link from 'next/link';

type PurchasedItem = { product?: { name: string; slug?: string } | null };

/** All delivered customers get the same invitation; the API enforces eligibility. */
export default function DeliveredReviewRequest({ status, items }: { status: string; items: PurchasedItem[] }) {
  if (status !== 'delivered') return null;
  const seen = new Set<string>();
  const bottles = items.flatMap(item => {
    const product = item.product;
    if (!product?.slug || seen.has(product.slug)) return [];
    seen.add(product.slug);
    return [{ name: product.name, slug: product.slug }];
  });
  if (!bottles.length) return null;

  return <section className="rounded-2xl border border-red-100 bg-red-50 p-5" aria-labelledby="delivered-review-request">
    <h2 id="delivered-review-request" className="text-lg font-bold text-gray-900">Share your bottle experience</h2>
    <p className="mt-2 text-sm leading-6 text-gray-700">Your honest feedback helps other shoppers. Open a product below, choose Reviews and sign in to write your review. You can add your own bottle or unboxing photos if you wish; avoid including personal details in photos. Reviews are subject to purchase eligibility and moderation.</p>
    <ul className="mt-4 flex flex-wrap gap-3">{bottles.map(product => <li key={product.slug}><Link className="inline-block rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-800 underline underline-offset-4" href={`/product/${encodeURIComponent(product.slug)}`}>{product.name}</Link></li>)}</ul>
  </section>;
}
