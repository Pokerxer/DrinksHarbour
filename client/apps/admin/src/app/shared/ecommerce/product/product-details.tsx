// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProductDetailsGallery from '@/app/shared/ecommerce/product/product-details-gallery';
import ProductDetailsSummery from '@/app/shared/ecommerce/product/product-details-summery';
import ProductDetailsDescription from '@/app/shared/ecommerce/product/product-details-description';
import { productService } from '@/services/product.service';
import { isBeverageProductType } from '@/utils/product-types';
import { PiSpinner, PiMagnifyingGlassBold } from 'react-icons/pi';

const toDisplayName = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value?.name || value?.slug || '';
};

export default function ProductDetails() {
  const params = useParams();
  const { data: session } = useSession();
  const [product, setProduct] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const slug = params?.slug;
    if (!slug || !session?.user?.token) return;

    let cancelled = false;
    setStatus('loading');
    productService
      .getProductById(slug, session.user.token, true)
      .then((res) => {
        if (cancelled) return;
        const p = res?.data?.product;
        if (!p) {
          setStatus('empty');
          return;
        }
        setProduct(p);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err?.message || 'Unable to load this product');
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [params?.slug, session?.user?.token]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3">
        <PiSpinner className="h-6 w-6 animate-spin text-blue-500" />
        <span className="text-gray-500">Loading product…</span>
      </div>
    );
  }

  if (status === 'empty' || status === 'error') {
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
      </div>
    );
  }

  const sps = product.subProducts || [];
  const firstSp = sps.find((s: any) => s.isPublished) || sps[0] || {};
  const isBeverage = isBeverageProductType(product.type);

  const viewModel = {
    isReal: true,
    id: product._id,
    name: product.name,
    slug: product.slug,
    type: product.type,
    subType: product.subType,
    style: product.style,
    categoryName: toDisplayName(product.category),
    subCategoryName: toDisplayName(product.subCategory),
    brandName: toDisplayName(product.brand),
    producer: product.producer || '',
    originCountry: product.originCountry || '',
    region: product.region || '',
    isAlcoholic: !!product.isAlcoholic,
    isBeverage,
    abv: product.abv,
    volumeMl: product.volumeMl,
    shortDescription: product.shortDescription || '',
    description: product.description || product.shortDescription || '',
    material: product.material,
    packCount: product.packCount,
    shelfLifeDays: product.shelfLifeDays,
    basePrice: firstSp.baseSellingPrice,
    salePrice: firstSp.isOnSale ? firstSp.salePrice ?? firstSp.baseSellingPrice : undefined,
    isOnSale: !!firstSp.isOnSale,
    currency: firstSp.currency || 'NGN',
    sizes: (firstSp.sizes || []).map((s: any) => ({
      size: s.size,
      displayName: s.displayName || s.size,
    })),
    images: product.images || [],
    status: product.status,
    isPublished: !!product.isPublished,
  };

  return (
    <div className="@container">
      <div className="@3xl:grid @3xl:grid-cols-12">
        <div className="col-span-7 mb-7 @container @lg:mb-10 @3xl:pe-10">
          <ProductDetailsGallery
            images={viewModel.images}
            productName={viewModel.name}
          />
        </div>
        <div className="col-span-5 @container">
          <ProductDetailsSummery product={viewModel} />
          <ProductDetailsDescription product={viewModel} />
        </div>
      </div>
    </div>
  );
}