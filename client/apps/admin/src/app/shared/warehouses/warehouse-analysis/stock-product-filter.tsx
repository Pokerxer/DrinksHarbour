import { useState } from 'react';
import ProductFilter from '../warehouse-location-analysis/product-filter';
export default function StockProductFilter({
  products,
  filters,
  change,
}: {
  products: { _id: string; name: string }[];
  filters: string[];
  change: (filters: string[]) => void;
}) {
  const [reset, setReset] = useState(0);
  const selected = filters.filter(
    (key) => key.startsWith('product_') && !key.startsWith('product_search:'),
  );
  const replaceProducts = (value: string) =>
    change([
      ...filters.filter((key) => !key.startsWith('product_')),
      ...value
        .split(',')
        .filter(Boolean)
        .map((id) => `product_${id}`),
    ]);
  const textRestricted = filters.some((key) => key.startsWith('product_search:'));
  return (
    <section
      aria-label="Stock product selection"
      className="mb-4 rounded-xl border border-[#ece4d6] bg-white p-4 shadow-sm"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)]">
        <div className="min-w-0">
          <ProductFilter
            key={reset}
            value={selected.map((key) => key.slice(8)).join(',')}
            products={products.map((product) => ({ id: product._id, label: product.name }))}
            change={replaceProducts}
          />
        </div>
        <div className="self-start text-xs leading-relaxed text-gray-500 lg:pt-7">
          <p>
            {selected.length
              ? `${selected.length} products selected`
              : textRestricted
                ? 'Products filtered by text'
                : 'All products included'}
            . Search, then choose products to compare.
          </p>
          <p className="mt-1">
            Selections update the chart, totals, pivot and export together. Other filters still
            apply.
          </p>
          {textRestricted && (
            <p className="mt-2">A product text search is active. Choosing products replaces it.</p>
          )}
          <button
            type="button"
            aria-pressed={!selected.length && !textRestricted}
            onClick={() => {
              replaceProducts('');
              setReset((value) => value + 1);
            }}
            className="mt-2 font-semibold text-[#b20202] underline"
          >
            Show all products
          </button>
        </div>
      </div>
    </section>
  );
}
