'use client';

import BusinessDetails from '@/app/shared/ecommerce/business-catalog/business-details';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProductDetailsGallery from '@/app/shared/ecommerce/product/product-details-gallery';
import { productService } from '@/services/product.service';
import { PiSpinner, PiMagnifyingGlassBold } from 'react-icons/pi';
import { useProductPrimaryImage } from './use-product-primary-image';

import CentralProductOverview, {
  type CentralProductIdentity,
} from './central-product-overview';
import CentralProductListings, {
  type CentralProductListing,
} from './central-product-listings';
import type { ProductGalleryImage } from './primary-image';

type CatalogProduct = CentralProductIdentity &
  Record<string, unknown> & {
    description?: string;
    images?: ProductGalleryImage[];
    subProducts?: CentralProductListing[];
  };

export default function ProductDetails() {
  const params = useParams<{ slug: string }>();
  const { data: session } = useSession();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = useState('');
  const [retry, setRetry] = useState(0);
  const canManageImages = ['super_admin', 'admin'].includes(
    session?.user?.role || ''
  );
  const { makePrimary, isSavingPrimary, primaryError, primarySuccess } =
    useProductPrimaryImage(
      product?._id,
      product?.images || [],
      canManageImages ? session?.user?.token : undefined,
      (images) =>
        setProduct((current) =>
          current && current._id === product?._id
            ? { ...current, images }
            : current
        )
    );

  useEffect(() => {
    const slug = params?.slug;
    if (!slug || !session?.user?.token) return;

    const controller = new AbortController();
    setStatus('loading');
    const request = canManageImages
      ? productService.getAdminProductDetails(
          slug,
          session.user.token,
          controller.signal
        )
      : productService.getProductById(
          slug,
          session.user.token,
          false,
          controller.signal
        );
    request
      .then((res) => {
        if (controller.signal.aborted) return;
        const p = (res as { data?: { product?: CatalogProduct } } | null)?.data
          ?.product;
        if (!p) {
          setStatus('empty');
          return;
        }
        setProduct(p);
        setStatus('ready');
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setErrorMsg(
          err instanceof Error ? err.message : 'Unable to load this product'
        );
        setStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [params?.slug, session?.user?.token, canManageImages, retry]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3">
        <PiSpinner className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-gray-500">Loading product…</span>
      </div>
    );
  }

  if (!product || status === 'empty' || status === 'error') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-10 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <PiMagnifyingGlassBold className="h-7 w-7" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">
          {status === 'empty' ? 'Product not found' : 'Could not load product'}
        </h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          {status === 'empty'
            ? 'This product does not exist or you do not have access to it.'
            : errorMsg}
        </p>
        {status === 'error' && (
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-4 min-h-11 rounded-lg border border-muted px-4 text-sm font-medium"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  const listings = product.subProducts || [];
  const sizes = listings.flatMap((listing) =>
    (listing.sizes || []).filter((size) => size !== null)
  );
  const description = product.description?.trim();

  return (
    <div className="space-y-6 @container">
      <div className="grid gap-6 @3xl:grid-cols-2">
        <CentralProductOverview product={product} canEdit={canManageImages} />
        <section aria-label="Product media" className="min-w-0 @container">
          <ProductDetailsGallery
            images={product.images || []}
            productName={product.name}
            onMakePrimary={canManageImages ? makePrimary : undefined}
            isSavingPrimary={isSavingPrimary}
          />
          {primaryError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {primaryError}
            </p>
          )}
          {primarySuccess && (
            <p role="status" className="mt-3 text-sm text-green-600">
              {primarySuccess}
            </p>
          )}
        </section>
      </div>

      <BusinessDetails product={product} sizes={sizes} />

      {description && description !== product.shortDescription?.trim() && (
        <section
          aria-labelledby="catalog-description"
          className="rounded-2xl border border-muted bg-white p-5 sm:p-6"
        >
          <h2 id="catalog-description" className="text-lg font-semibold">
            Description
          </h2>
          <p className="mt-3 whitespace-pre-line break-words leading-relaxed text-gray-700">
            {description}
          </p>
        </section>
      )}
      {canManageImages && <CentralProductListings listings={listings} />}
    </div>
  );
}
