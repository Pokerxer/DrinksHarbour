import Image from 'next/image';
import { PiPackage, PiCheck, PiArrowRight } from 'react-icons/pi';
import type { Product } from './ProductSearchResults';

export default function CatalogMatchRow({
  product,
  query = '',
  active = false,
  selected = false,
  closest = false,
  index,
  onSelect,
}: {
  product: Product;
  query?: string;
  active?: boolean;
  selected?: boolean;
  closest?: boolean;
  index?: number;
  onSelect: (product: Product) => void;
}) {
  const thumb = product.thumbImage?.[0];
  const image =
    product.primaryImage?.url ||
    product.images?.[0]?.url ||
    (typeof thumb === 'string' ? thumb : thumb?.url);
  const brand =
    typeof product.brand === 'string' ? product.brand : product.brand?.name;
  const parts = query.trim()
    ? product.name.split(
        new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      )
    : [product.name];
  return (
    <button
      type="button"
      data-index={index}
      aria-label={`Use ${product.name}`}
      aria-pressed={selected}
      onClick={() => onSelect(product)}
      className={`group flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active || selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'}`}
    >
      <span className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-50 sm:h-16 sm:w-16">
        {image ? (
          <Image
            src={image}
            alt=""
            fill
            sizes="64px"
            className="object-contain p-1"
          />
        ) : (
          <PiPackage className="h-6 w-6 text-gray-400" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-[11px] font-semibold text-blue-700">
          {closest && product.matchKind !== 'related'
            ? 'Closest match'
            : product.matchReason || 'Related product'}
        </span>
        <span className="block break-words text-sm font-semibold leading-snug text-gray-900">
          {parts.map((part, i) =>
            query.trim() && part.toLowerCase() === query.toLowerCase() ? (
              <mark
                key={i}
                className="rounded bg-amber-100 px-0.5 text-inherit"
              >
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
          {brand && <span>{brand}</span>}
          {product.type && (
            <span className="capitalize">
              {product.type.replace(/_/g, ' ')}
            </span>
          )}
          {product.volumeMl != null && <span>{product.volumeMl} ml</span>}
          {product.abv != null && <span>{product.abv}% ABV</span>}
          {product.status === 'pending' && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700">
              Pending approval
            </span>
          )}
        </span>
      </span>
      <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-700">
        {selected ? (
          <PiCheck className="h-4 w-4" />
        ) : (
          <PiArrowRight className="h-4 w-4" />
        )}
      </span>
    </button>
  );
}
