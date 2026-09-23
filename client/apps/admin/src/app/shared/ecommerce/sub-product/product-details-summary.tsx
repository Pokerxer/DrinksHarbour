// @ts-nocheck
'use client';

import Link from 'next/link';
import { productTaxonomyLabel as typeLabel } from '@/utils/product-taxonomy-label';
import DuplicateSubProductButton from './duplicate-button';
import { Button, Title, Badge } from 'rizzui';

const formatPrice = (value: any, currency: string) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return null;
  }
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency || 'NGN'} ${Number(value).toLocaleString()}`;
  }
};

const humanizeSize = (code: string) => {
  if (!code) return 'Default';
  const setMatch = code.match(/^set-(\d+)$/);
  if (setMatch) return `Set of ${setMatch[1]}`;
  const bagMatch = code.match(/^bag-(.+)$/);
  if (bagMatch) return `Bag ${bagMatch[1]}`;
  const tinMatch = code.match(/^tin-(.+)$/);
  if (tinMatch) return `Tin ${tinMatch[1]}`;
  const map: Record<string, string> = {
    'unit-single': 'Single',
    'piece-single': 'Single Piece',
    unit: 'Single',
    pair: 'Pair',
    'box-single': 'Single Box',
    'bar-single': 'Single Bar',
    'bar-2': '2-Bar Pack',
    'gift-set': 'Gift Set',
    'tasting-set': 'Tasting Set',
    'variety-pack': 'Variety Pack',
    custom: 'Custom',
  };
  return map[code] || code;
};

const sizeLabel = (s: any) =>
  s.displayName && s.displayName !== s.size
    ? s.displayName
    : humanizeSize(s.size);

const isInStock = (s: any) =>
  Number(s?.stock) > 0 && s?.availability !== false;

export default function SubProductDetailsSummary({
  product,
  showActions = true,
}: {
  product: any;
  showActions?: boolean;
}) {
  const currency = product.currency || 'NGN';
  const headlinePrice = formatPrice(
    product.salePrice ?? product.baseSellingPrice,
    currency
  );
  const stock = Number(product.stock);
  const hasStock =
    !Number.isNaN(stock) && stock >= 0 && product.stock !== null;

  return (
    <>
      <div className="border-b border-muted pb-6 @lg:pb-8">
        <Title as="h2" className="mb-2.5 font-bold @6xl:text-4xl">
          {product.name}
        </Title>
        <div className="flex flex-wrap items-center gap-2">
          {product.type && (
            <Badge color="primary" rounded="md">
              {typeLabel(product.type)}
            </Badge>
          )}
          {product.subType && (
            <Badge color="blue" rounded="md" variant="flat">
              {typeLabel(product.subType)}
            </Badge>
          )}
          {product.style && (
            <Badge color="secondary" rounded="md" variant="outline">
              {typeLabel(product.style)}
            </Badge>
          )}
          {product.isAlcoholic && (
            <Badge color="danger" rounded="md">
              Alcoholic
            </Badge>
          )}
          <Badge
            color={product.isPublished ? 'success' : 'warning'}
            rounded="md"
          >
            {product.isPublished
              ? 'Published'
              : product.status
                ? typeLabel(product.status)
                : 'Unpublished'}
          </Badge>
          {product.tenantName && (
            <Badge color="secondary" rounded="md">
              {product.tenantName}
            </Badge>
          )}
        </div>
      </div>

      <div className="pb-8 pt-5">
        <div className="mb-1.5 flex items-end font-lexend text-base">
          <div className="-mb-0.5 text-2xl font-semibold text-gray-900 lg:text-3xl">
            {headlinePrice || 'Price not set'}
          </div>
        </div>

        {/* Size variants with tenant pricing + stock */}
        {product.sizes?.length ? (
          <div className="mt-5">
            <Title as="h6" className="mb-2 font-inter text-sm font-medium">
              Sizes &amp; Pricing
            </Title>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              {product.sizes.map((s: any, idx: number) => (
                <div
                  key={s.id || idx}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3.5 py-3 text-sm last:border-b-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {sizeLabel(s)}
                    </span>
                    {s.isDefault && (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                        Default
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-900">
                      {formatPrice(s.sellingPrice, currency) || '—'}
                    </span>
                    {isInStock(s) ? (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        In stock · {s.stock}
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                        Out of stock
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <Title as="h6" className="mb-2 font-inter text-sm font-medium">
              Inventory
            </Title>
            {hasStock ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                {stock} in stock
              </span>
            ) : (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                Out of stock
              </span>
            )}
          </div>
        )}

        {/* Operational metadata */}
        <div className="mt-6 space-y-2 border-t border-muted pt-5 text-sm text-gray-600">
          {product.sku && (
            <p>
              <span className="font-medium text-gray-900">SKU: </span>
              {product.sku}
            </p>
          )}
          {product.barcode && (
            <p>
              <span className="font-medium text-gray-900">Barcode: </span>
              {product.barcode}
            </p>
          )}
          {(product.brandName ||
            product.categoryName ||
            product.originCountry) && (
            <p>
              <span className="font-medium text-gray-900">Product: </span>
              {[product.brandName, product.categoryName, product.originCountry]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {product.revenueModel && (
            <p>
              <span className="font-medium text-gray-900">Revenue model: </span>
              {product.revenueModel === 'markup'
                ? `Markup${product.markupPercentage ? ` ${product.markupPercentage}%` : ''}`
                : `Commission${product.commissionPercentage ? ` ${product.commissionPercentage}%` : ''}`}
            </p>
          )}
        </div>

        {showActions && <div className="mt-8">
          <Link href={product.editHref || `/sub-products/${product.id}/edit`}>
            <Button
              size="xl"
              className="h-12 w-full text-sm lg:h-14 lg:text-base"
            >
              Edit Sub-Product
            </Button>
          </Link>
          <DuplicateSubProductButton sourceId={product.id} />
        </div>}
      </div>
    </>
  );
}