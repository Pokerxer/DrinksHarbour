import registry from '@/utils/business-specifications.json';
import {
  businessFacts,
  businessPresentation,
  catalogBusiness,
} from '@/utils/catalog-business';

import {
  businessVariantFacts,
  type BusinessVariant,
} from './business-variant-facts';

export default function BusinessDetails({
  product,
  sizes = [],
  showVariants = true,
}: {
  product: Record<string, unknown>;
  sizes?: BusinessVariant[];
  showVariants?: boolean;
}) {
  const business = catalogBusiness(
    typeof product.type === 'string' ? product.type : undefined
  );
  const presentation = businessPresentation[business];
  const facts = businessFacts(product);
  const specifications = product.specifications as
    | Record<string, unknown>
    | undefined;
  for (const field of (registry as Record<string, string[]>)[business] || []) {
    const value = specifications?.[field];
    if (typeof value === 'string' && value.trim())
      facts.push([field.replace(/([A-Z])/g, ' $1'), value]);
  }
  // Central options are a catalog summary. The linked listing table owns
  // seller-specific identity, pricing and stock.
  const variants = new Map<
    string,
    { label: string; color?: string; facts: string[] }
  >();
  if (showVariants) {
    for (const size of sizes) {
      const label = size.displayName || size.size || 'Unnamed option';
      const facts = businessVariantFacts(size, business);
      const key = JSON.stringify([label, size.colorName, facts]);
      variants.set(key, { label, color: size.colorName, facts });
    }
  }
  return (
    <section
      className="mb-6 rounded-2xl border border-gray-200 bg-white p-5"
      aria-label={`${presentation.title} details`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {presentation.title}
      </p>
      <h2 className="mt-1 text-lg font-semibold">Product specifications</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0 border-t border-gray-100 pt-2">
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="mt-1 break-words text-sm">{value}</dd>
          </div>
        ))}
      </dl>
      {showVariants && (
        <>
          <h3 className="mt-5 text-sm font-semibold">
            {presentation.variants}
          </h3>
          {variants.size ? (
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from(variants, ([key, variant]) => (
                <li
                  key={key}
                  className="rounded-lg border border-gray-200 bg-white p-3 text-sm"
                >
                  <span className="font-medium">{variant.label}</span>
                  {variant.color && (
                    <span className="ml-2">· {variant.color}</span>
                  )}
                  <ul className="mt-1 space-y-1 text-xs text-gray-600">
                    {variant.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              No options recorded yet.
            </p>
          )}
        </>
      )}
    </section>
  );
}
