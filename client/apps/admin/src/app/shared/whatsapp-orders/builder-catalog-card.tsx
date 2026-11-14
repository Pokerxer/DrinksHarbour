'use client';
import { useMemo, useState } from 'react';
import Image from 'next/image';
import { PiPackage, PiPlus } from 'react-icons/pi';

/** One cross-tenant catalogue row (SubProduct) as returned by
 *  GET /api/subproducts?status=active (super_admin/admin JWT — each row
 *  carries exactly ONE tenant). */
export interface BuilderCatalogRow {
  _id: string;
  sku?: string;
  product?: {
    _id: string;
    name?: string;
    images?: { url?: string }[];
    isAlcoholic?: boolean;
    abv?: number;
    brand?: { name?: string } | null;
    category?: { name?: string } | null;
  } | null;
  tenant?: { name?: string; slug?: string } | null;
  sizes?: Array<{
    _id: string;
    displayName?: string;
    sellingPrice?: number;
    stock?: number;
    availableStock?: number;
    barcode?: string;
    unitsPerPack?: number;
  }>;
}

/** Cloudinary card thumb — same transform the sales catalogue uses
 *  (sales-catalog-data.ts thumbnail). Copied here: the helper is not exported. */
export function catalogThumb(url?: string) {
  if (!url) return undefined;
  return url.includes('res.cloudinary.com')
    ? url.replace('/upload/', '/upload/c_fit,w_480,h_480,q_auto,f_auto/')
    : url;
}

/** Sellable stock across the row's sizes (list rows carry only one tenant,
 *  so this is that tenant's stock for the product). */
export const rowStock = (row: BuilderCatalogRow) =>
  (row.sizes || []).reduce((n, s) => n + (s.availableStock ?? s.stock ?? 0), 0);

export default function BuilderCatalogCard({
  row,
  onAdd,
}: {
  row: BuilderCatalogRow;
  /** Always opens the tenant picker (even single-tenant — it doubles as the
   *  size selector); marketplace prices only exist via fetchTenantOffers. */
  onAdd: (row: BuilderCatalogRow) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const product = row.product;
  const name = product?.name || 'Unnamed product';
  const image = useMemo(() => catalogThumb(product?.images?.[0]?.url), [product]);
  const stock = useMemo(() => rowStock(row), [row]);
  const subtitle = useMemo(
    () =>
      [product?.brand?.name, product?.category?.name, row.sku]
        .filter(Boolean)
        .join(' · '),
    [product, row.sku],
  );
  const selectable = Boolean(product?._id);

  return (
    <article
      aria-label={name}
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white transition-shadow hover:shadow-sm"
    >
      <div className="relative flex h-52 items-center justify-center bg-gray-50/70 sm:h-56">
        {image && !imageFailed ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="266px"
            className="object-contain p-2"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <PiPackage className="h-12 w-12 text-gray-300" />
        )}
        <span
          className={`absolute left-2 top-2 rounded-md px-2 py-1 text-[11px] font-semibold shadow-sm ${
            stock > 0 ? 'bg-white text-emerald-700' : 'bg-white text-gray-500'
          }`}
        >
          {stock > 0 ? `${stock} available` : 'Out of stock'}
        </span>
        {product?.isAlcoholic && (
          <span className="absolute bottom-2 right-2 rounded bg-white/90 px-1.5 py-1 text-[10px] text-gray-600">
            {product.abv ?? 0}% ABV · 18+
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-gray-900">
          {name}
        </h3>
        {subtitle && (
          <p className="mt-1 truncate text-xs text-gray-500">{subtitle}</p>
        )}
        <p className="mt-0.5 truncate text-xs text-gray-400">
          {row.tenant?.name ? `Offered by ${row.tenant.name}` : 'Tenant listings…'}
        </p>
        <div className="mt-auto pt-3">
          <button
            type="button"
            disabled={!selectable}
            onClick={() => onAdd(row)}
            className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400"
          >
            <PiPlus /> Add to order
          </button>
        </div>
      </div>
    </article>
  );
}
