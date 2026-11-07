'use client';

import Link from 'next/link';
import { productTaxonomyLabel as typeLabel } from '@/utils/product-taxonomy-label';
import DuplicateSubProductButton from './duplicate-button';
import {
  TENANT_PRIVATE_IDENTITY_LABEL,
  TENANT_PRIVATE_IDENTITY_NOTE,
  isTenantPrivateProduct,
} from './catalogue-scope';
import { Title, Badge } from 'rizzui';

import {
  businessPresentation,
  catalogBusiness,
} from '@/utils/catalog-business';
import ListingOptionDetails, {
  formatListingPrice,
  ListingStock,
  type ListingOption,
} from './listing-option-details';

export interface ListingSummary {
  id: string;
  name: string;
  editHref?: string;
  type?: string;
  subType?: string;
  style?: string;
  isAlcoholic?: boolean;
  isPublished?: boolean;
  status?: string;
  publicationScope?: string;
  tenantName?: string;
  currency?: string;
  salePrice?: number | null;
  baseSellingPrice?: number | null;
  isOnSale?: boolean;
  stock?: number | null;
  sizes?: ListingOption[];
  sku?: string;
  barcode?: string;
  brandName?: string;
  categoryName?: string;
  originCountry?: string;
  revenueModel?: string;
  sellingPriceMarkupPercentage?: number;
  markupPercentage?: number;
  commissionPercentage?: number;
}

export default function SubProductDetailsSummary({
  product,
  showActions = true,
}: {
  product: ListingSummary;
  showActions?: boolean;
}) {
  const currency = product.currency || 'NGN';
  const business = catalogBusiness(product.type);
  const presentation = businessPresentation[business];
  const headlinePrice = formatListingPrice(
    (product.isOnSale ? product.salePrice : undefined) ??
      product.baseSellingPrice,
    currency
  );

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-5"
      aria-label="Listing overview"
    >
      <div className="border-b border-muted pb-4">
        <Title as="h2" className="mb-2.5 text-lg font-semibold">
          {showActions ? product.name : 'Listing overview'}
        </Title>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="secondary" rounded="md" variant="flat">
            {presentation.title}
          </Badge>
          {product.type && (
            <Badge color="primary" rounded="md">
              {typeLabel(product.type)}
            </Badge>
          )}
          {product.subType && (
            <Badge color="info" rounded="md" variant="flat">
              {typeLabel(product.subType)}
            </Badge>
          )}
          {product.style && (
            <Badge color="secondary" rounded="md" variant="outline">
              {typeLabel(product.style)}
            </Badge>
          )}
          {business === 'beverage' && product.isAlcoholic && (
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
          {/* Central-catalogue identity, subordinate to the operational
              badges — only for an explicitly private central Product. */}
          {isTenantPrivateProduct(product) && (
            <span
              title={TENANT_PRIVATE_IDENTITY_NOTE}
              className="inline-flex items-center rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600"
            >
              {TENANT_PRIVATE_IDENTITY_LABEL}
            </span>
          )}
          {product.tenantName && (
            <Badge color="secondary" rounded="md">
              {product.tenantName}
            </Badge>
          )}
        </div>
      </div>

      <div className="pt-5">
        <p className="text-xs font-medium text-gray-600">Listing price</p>
        <div className="mb-1.5 flex items-end font-lexend text-base">
          <div className="-mb-0.5 text-2xl font-semibold text-gray-900 @xl:text-3xl">
            {headlinePrice || 'Price not set'}
          </div>
        </div>

        <div className="mt-5">
          <Title as="h3" className="mb-2 text-sm font-medium">
            Inventory
          </Title>
          <ListingStock stock={product.stock} />
        </div>

        {!!product.sizes?.length && (
          <div className="mt-5">
            <Title as="h3" className="mb-2 text-sm font-medium">
              {presentation.variants}
            </Title>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
              {product.sizes.map((option, index) => (
                <ListingOptionDetails
                  key={option.id || index}
                  option={option}
                  business={business}
                  currency={currency}
                />
              ))}
            </ul>
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
              {product.revenueModel === 'selling_price_markup'
                ? `Selling-price markup ${product.sellingPriceMarkupPercentage ?? 0}%`
                : product.revenueModel === 'markup'
                  ? `Markup${product.markupPercentage ? ` ${product.markupPercentage}%` : ''}`
                  : `Commission${product.commissionPercentage ? ` ${product.commissionPercentage}%` : ''}`}
            </p>
          )}
        </div>

        {showActions && (
          <div className="mt-8">
            <Link
              href={product.editHref || `/sub-products/${product.id}/edit`}
              className="flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit Sub-Product
            </Link>
            <DuplicateSubProductButton sourceId={product.id} />
          </div>
        )}
      </div>
    </section>
  );
}
