'use client';

import BusinessGenerationPanel from './business-generation-panel';
import BusinessDetails from '@/app/shared/ecommerce/business-catalog/business-details';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProductDetailsGallery from '@/app/shared/ecommerce/product/product-details-gallery';
import ListingDescription from './product-details-description';
import SubProductDetailsSummary, {
  type ListingSummary,
} from './product-details-summary';
import type { ListingOption } from './listing-option-details';
import type { ProductGalleryImage } from '../product/primary-image';
import ProductDetailsToolbar from './product-details-toolbar';
import {
  subproductService,
  type SubProductData,
} from '@/services/subproduct.service';
import { PiSpinner, PiMagnifyingGlassBold } from 'react-icons/pi';

type DisplayReference = string | { name?: string; slug?: string };
type CatalogueProduct = Record<string, unknown> & {
  name?: string;
  type?: string;
  subType?: string;
  style?: string;
  category?: DisplayReference;
  brand?: DisplayReference;
  originCountry?: string;
  isAlcoholic?: boolean;
  description?: string;
  shortDescription?: string;
  publicationScope?: string;
  images?: ProductGalleryImage[];
};
type Tenant = {
  slug?: string;
  name?: string;
  businessName?: string;
  defaultCurrency?: string;
  revenueModel?: string;
  markupPercentage?: number;
  commissionPercentage?: number;
  sellingPriceMarkupPercentage?: number;
};
type ListingSize = ListingOption & {
  stockQuantity?: number;
  availableStock?: number;
  discountStart?: string;
  discountEnd?: string;
};
type Listing = Omit<SubProductData, 'product' | 'tenant' | 'sizes'> & {
  _id: string;
  product?: CatalogueProduct | null;
  tenant?: Tenant | null;
  sizes?: ListingSize[];
  barcode?: string;
  isPublished?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
  seoH1?: string;
};
type ListingResponse = { data?: { subProduct?: Listing } };

const toDisplayName = (value?: DisplayReference) =>
  typeof value === 'string' ? value : value?.name || value?.slug || '';

function activeSale(
  enabled?: boolean,
  starts?: string | null,
  ends?: string | null
) {
  const now = Date.now();
  return (
    !!enabled &&
    (!starts || Date.parse(starts) <= now) &&
    (!ends || Date.parse(ends) >= now)
  );
}

export default function SubProductDetails() {
  const { slug: id } = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const token = session?.user?.token;
  const [result, setResult] = useState<{
    id: string;
    token: string;
    product: Listing;
  } | null>(null);
  const subProduct =
    result?.id === id && result.token === token ? result.product : null;
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!id || !token) return;

    const controller = new AbortController();
    setStatus('loading');
    subproductService
      .getSubProduct<ListingResponse>(
        id,
        token,
        reload ? { refresh: 'true' } : undefined,
        controller.signal
      )
      .then((res) => {
        if (controller.signal.aborted) return;
        const sp = res?.data?.subProduct;
        if (!sp) {
          setStatus('empty');
          return;
        }
        setResult({ id, token, product: sp });
        setStatus('ready');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to load this sub-product'
        );
        setStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [id, token, reload]);

  if (status === 'loading' || (status === 'ready' && !subProduct)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3">
        <PiSpinner className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-gray-500">Loading sub-product…</span>
      </div>
    );
  }

  if (!subProduct || status === 'empty' || status === 'error') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <PiMagnifyingGlassBold className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {status === 'empty'
            ? 'Sub-Product not found'
            : 'Could not load sub-product'}
        </h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          {status === 'empty'
            ? 'This selling instance does not exist or you do not have access to it.'
            : errorMsg}
        </p>
        {status === 'error' && (
          <button
            type="button"
            className="mt-4 rounded-md border px-4 py-2 text-sm font-medium"
            onClick={() => setReload((value) => value + 1)}
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  const product = subProduct.product || {};
  const tenant = subProduct.tenant || {};
  const sizes = subProduct.sizes || [];
  const defaultSize = sizes.find((size) => size.isDefault) || sizes[0];
  const currency =
    subProduct.currency ||
    defaultSize?.currency ||
    tenant.defaultCurrency ||
    'NGN';
  const listingCopy =
    subProduct.descriptionOverride?.trim() ||
    subProduct.shortDescriptionOverride?.trim();
  const description =
    listingCopy || product.description || product.shortDescription;
  const images = subProduct.imagesOverride?.some((image) => image?.url)
    ? subProduct.imagesOverride
    : product.images || [];
  const viewModel: ListingSummary = {
    id: subProduct._id,
    name: product.name || 'Sub-product',
    type: product.type,
    subType: product.subType,
    style: product.style,
    categoryName: toDisplayName(product.category),
    brandName: toDisplayName(product.brand),
    originCountry: product.originCountry,
    isAlcoholic: product.isAlcoholic,
    status: subProduct.status || 'draft',
    isPublished: !!subProduct.isPublished,
    publicationScope: product.publicationScope,
    sku: subProduct.sku,
    barcode: subProduct.barcode,
    stock: subProduct.availableStock,
    tenantName: tenant.businessName || tenant.name,
    revenueModel: tenant.revenueModel,
    markupPercentage: tenant.markupPercentage,
    commissionPercentage: tenant.commissionPercentage,
    sellingPriceMarkupPercentage: tenant.sellingPriceMarkupPercentage,
    currency,
    baseSellingPrice: subProduct.baseSellingPrice,
    salePrice: subProduct.salePrice,
    isOnSale: activeSale(
      subProduct.isOnSale,
      subProduct.saleStartDate,
      subProduct.saleEndDate
    ),
    sizes: sizes.map((size) => ({
      ...size,
      id: size._id,
      isOnSale: activeSale(size.isOnSale, size.discountStart, size.discountEnd),
      stock: size.availableStock ?? size.stockQuantity ?? size.stock,
    })),
  };
  const canGenerate =
    token &&
    ['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(
      session?.user?.role || ''
    );

  return (
    <div className="@container">
      <ProductDetailsToolbar
        key={viewModel.id}
        id={viewModel.id}
        name={viewModel.name}
        status={viewModel.status || 'draft'}
        published={!!viewModel.isPublished}
        stock={Number(viewModel.stock ?? 0)}
        price={Number(
          (viewModel.isOnSale ? viewModel.salePrice : undefined) ??
            viewModel.baseSellingPrice ??
            0
        )}
        currency={currency}
        token={token}
        onChanged={() => setReload((value) => value + 1)}
      />
      <div className="grid items-start gap-6 @4xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <section aria-label="Listing images">
            <ProductDetailsGallery
              images={images}
              productName={viewModel.name}
            />
          </section>
          <ListingDescription
            description={description}
            isOverride={!!listingCopy}
          />
        </div>
        <SubProductDetailsSummary product={viewModel} showActions={false} />
      </div>
      <div className="mt-6">
        <BusinessDetails product={product} showVariants={false} />
      </div>
      {canGenerate && (
        <BusinessGenerationPanel
          key={viewModel.id}
          id={viewModel.id}
          productType={product.type}
          token={token}
          tenantSlug={tenant.slug}
          saved={{
            metaTitle: subProduct.metaTitle || '',
            metaDescription: subProduct.metaDescription || '',
            metaKeywords: subProduct.metaKeywords || [],
            seoH1: subProduct.seoH1 || '',
          }}
          onSaved={() => setReload((value) => value + 1)}
        />
      )}
    </div>
  );
}
