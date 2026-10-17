import { PiMagnifyingGlass, PiPlusCircle } from 'react-icons/pi';
import CatalogMatchRow from './CatalogMatchRow';

export interface Product {
  id?: string;
  _id?: string;
  name: string;
  slug?: string;
  type?: string;
  brand?: { name: string } | string;
  category?: { name: string } | string;
  images?: Array<{ url: string; alt: string }>;
  primaryImage?: { url: string; alt: string };
  thumbImage?: Array<string | { url: string }>;
  availability?: {
    status: string;
    totalStock?: number;
  };
  barcode?: string;
  volumeMl?: number;
  abv?: number;
  status?: string;
  matchKind?: 'exact' | 'close' | 'related';
  matchReason?: string;
}

interface ProductSearchResultsProps {
  products: Product[];
  selectedIndex: number;
  selectedProductId?: string;
  highlightedText: string;
  isLoading: boolean;
  searchQuery: string;
  onSelect: (product: Product) => void;
  onCreateNew?: (searchQuery: string) => void;
}

export function ProductSearchResults({
  products,
  selectedIndex,
  selectedProductId,
  highlightedText,
  isLoading,
  searchQuery,
  onSelect,
  onCreateNew,
}: ProductSearchResultsProps) {
  return (
    <section
      aria-label="Catalog search results"
      className="absolute z-50 mt-2 flex max-h-[min(520px,65dvh)] w-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl"
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">
          {isLoading
            ? 'Searching catalog…'
            : `${products.length} match${products.length !== 1 ? 'es' : ''}`}
        </p>
        <p className="text-xs text-gray-500">
          Closest first{' '}
          <span className="hidden sm:inline">
            · ↑ ↓ to browse · Enter to select
          </span>
        </p>
      </header>
      <div className="min-h-0 overflow-y-auto overscroll-contain p-2 sm:p-3">
        {isLoading ? (
          <p
            role="status"
            className="px-3 py-8 text-center text-sm text-gray-500"
          >
            Finding matching products…
          </p>
        ) : products.length ? (
          <ul className="space-y-2">
            {products.map((product, index) => (
              <li key={product._id || product.id}>
                <CatalogMatchRow
                  product={product}
                  query={highlightedText}
                  index={index}
                  active={index === selectedIndex}
                  selected={selectedProductId === (product._id || product.id)}
                  closest={index === 0}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div role="status" className="px-3 py-7 text-center">
            <PiMagnifyingGlass className="mx-auto mb-3 h-6 w-6 text-gray-400" />
            <p className="text-sm font-semibold text-gray-900">
              No catalog matches
            </p>
            <p className="mt-1 break-words text-sm text-gray-500">
              Try another name or brand for “{searchQuery}”.
            </p>
          </div>
        )}
      </div>
      {onCreateNew && !isLoading && (
        <footer className="shrink-0 border-t border-gray-100 bg-gray-50 px-3 py-3">
          <p className="mb-2 text-center text-xs text-gray-500">
            Only create a product if the same drink is missing.
          </p>
          <button
            type="button"
            onClick={() => onCreateNew(searchQuery)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <PiPlusCircle className="h-4 w-4" />
            Create new product
          </button>
        </footer>
      )}
    </section>
  );
}

export default ProductSearchResults;
