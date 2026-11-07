import Link from 'next/link';

type Bottle = { name: string; abv?: number | null; originCountry?: string; region?: string };

export default function ProductBuyingQuestions({ product }: { product: Bottle }) {
  const origin = [product.originCountry, product.region].filter(Boolean).join(', ');
  return (
    <section className="container mx-auto px-4 py-10" aria-labelledby="product-buying-questions">
      <h2 id="product-buying-questions" className="text-2xl font-bold">Questions about {product.name}</h2>
      <div className="mt-5 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white px-5">
        {product.abv != null && <details className="py-4">
          <summary className="cursor-pointer font-semibold">What is the alcohol content?</summary>
          <p className="mt-3 leading-7 text-gray-700">The catalogue lists {product.name} at {product.abv}% ABV. Check the selected bottle’s label for its exact specification. Alcoholic drinks are for adults aged 18 and over.</p>
        </details>}
        {origin && <details className="py-4">
          <summary className="cursor-pointer font-semibold">Where is this drink from?</summary>
          <p className="mt-3 leading-7 text-gray-700">The listed origin is {origin}. Read the product description and bottle label for producer and regional details.</p>
        </details>}
        <details className="py-4">
          <summary className="cursor-pointer font-semibold">How do I compare seller prices?</summary>
          <p className="mt-3 leading-7 text-gray-700">Choose the same bottle size and quantity for each seller. Compare the unit price, pack quantity and stock, then check delivery charges before paying. The selected offer controls your cart price and available quantity.</p>
        </details>
        <details className="py-4">
          <summary className="cursor-pointer font-semibold">Can I order for Abuja or Lagos?</summary>
          <p className="mt-3 leading-7 text-gray-700">Check <Link className="underline" href="/delivery/abuja">Abuja delivery</Link> or <Link className="underline" href="/delivery/lagos">Lagos delivery</Link> before ordering. The available service, fee and timing depend on your address and order; checkout confirms the available options.</p>
        </details>
        <details className="py-4">
          <summary className="cursor-pointer font-semibold">What if I have a concern about my bottle?</summary>
          <p className="mt-3 leading-7 text-gray-700">Keep the bottle and packaging, avoid consuming it if you have concerns, and contact support with your order reference and photos. Read our <Link className="underline" href="/authenticity-guarantee">authenticity and bottle-check guidance</Link> and <Link className="underline" href="/returns">returns policy</Link>.</p>
        </details>
      </div>
    </section>
  );
}
