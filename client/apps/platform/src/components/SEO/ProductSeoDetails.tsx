import Link from 'next/link';
import { OPPORTUNITY_PRODUCTS } from './OpportunityProductLinks';

type ProductSeoDetailsProps = {
  slug: string;
  product: Record<string, any>;
};

/** Adds useful, server-rendered buying context to the identified opportunity pages. */
export default function ProductSeoDetails({ slug, product }: ProductSeoDetailsProps) {
  if (!OPPORTUNITY_PRODUCTS.some((item) => item.slug === slug)) return null;

  const facts = [
    product.brand?.name && `Brand: ${product.brand.name}`,
    product.type && `Style: ${String(product.type).replace(/_/g, ' ')}`,
    product.abv != null && `ABV: ${product.abv}%`,
    product.volume != null && `Bottle size: ${product.volume}ml`,
    (product.originCountry || product.region) && `Origin: ${product.originCountry || product.region}`,
  ].filter(Boolean) as string[];

  return (
    <section className="border-y border-stone-200 bg-white px-4 py-8" aria-labelledby="product-buying-guide">
      <div className="mx-auto max-w-6xl">
        <h2 id="product-buying-guide" className="text-xl font-bold text-stone-900">About this bottle</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
          Review the bottle details, current price and availability before ordering. DrinksHarbour checks products before dispatch and offers delivery across Nigeria; delivery timing depends on the destination shown at checkout.
        </p>
        {facts.length > 0 && <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-700">{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>}
        <p className="mt-4 text-sm text-stone-600">
          Looking for a similar drink? <Link className="font-semibold text-[#7C1D1D] underline-offset-2 hover:underline" href="/shop">Compare related bottles and prices in the drinks shop</Link>.
        </p>
      </div>
    </section>
  );
}
