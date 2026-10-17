'use client';

import CatalogMatchRow from './CatalogMatchRow';
import type { Product } from './ProductSearchResults';
import { useCatalogueMatches } from '../use-catalogue-matches';

export default function ClosestProductMatches({
  name,
  token,
  onSelect,
}: {
  name: string;
  token?: string;
  onSelect: (product: Product) => void;
}) {
  const { products, loading, error, retry } = useCatalogueMatches(name, token);
  if (!token || name.trim().length < 2) return null;

  return (
    <section
      aria-label="Closest catalog matches"
      className="mt-3 rounded-xl border border-blue-200 bg-blue-50/40 p-3"
    >
      <h4 className="text-sm font-semibold text-gray-900">
        Closest catalog matches
      </h4>
      <p className="mt-1 text-xs text-gray-600">
        Use an existing product if it is the same drink. Your store prices and
        sizes stay separate.
      </p>
      {loading ? (
        <p role="status" className="mt-3 text-sm text-gray-500">
          Checking the catalog…
        </p>
      ) : error ? (
        <div role="alert" className="mt-3 text-sm text-red-600">
          {error}
          <button
            type="button"
            onClick={retry}
            className="ml-2 min-h-11 font-semibold underline"
          >
            Retry catalog search
          </button>
        </div>
      ) : products.length === 0 ? (
        <p role="status" className="mt-3 text-sm text-gray-500">
          No close catalog matches found.
        </p>
      ) : (
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
          {products.slice(0, 4).map((product, index) => (
            <li key={product._id || product.id}>
              <CatalogMatchRow
                product={product}
                closest={index === 0}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
