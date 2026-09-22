// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ProductDetailsGallery from '@/app/shared/ecommerce/product/product-details-gallery';
import ProductDetailsDescription from '@/app/shared/ecommerce/product/product-details-description';
import SubProductDetailsSummary from '@/app/shared/ecommerce/sub-product/product-details-summary';
import { subproductService } from '@/services/subproduct.service';
import { isBeverageProductType } from '@/utils/product-types';
import { PiSpinner, PiMagnifyingGlassBold } from 'react-icons/pi';

const toDisplayName = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value?.name || value?.slug || '';
};

export default function SubProductDetails() {
  const params = useParams();
  const { data: session } = useSession();
  const [subProduct, setSubProduct] = useState<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    'loading'
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const id = params?.slug;
    if (!id || !session?.user?.token) return;

    let cancelled = false;
    setStatus('loading');
    subproductService
      .getSubProduct(id, session.user.token)
      .then((res) => {
        if (cancelled) return;
        const sp = res?.data?.subProduct;
        if (!sp) {
          setStatus('empty');
          return;
        }
        setSubProduct(sp);
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMsg(err?.message || 'Unable to load this sub-product');
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
        <span className="text-gray-500">Loading sub-product…</span>
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
          {status === 'empty'
            ? 'Sub-Product not found'
            : 'Could not load sub-product'}
        </h2>
        <p className="mt-2 max-w-md text-sm text-gray-500">
          {status === 'empty'
            ? 'This selling instance does not exist or you do not have access to it.'
            : errorMsg}
        </p>
      </div>
    );
  }

  const product = subProduct.product || {};
  const tenant = subProduct.tenant || {};
  const isBeverage = isBeverageProductType(product.type);
  const defaultSize =
    (subProduct.sizes || []).find((s: any) => s.isDefault) ||
    (subProduct.sizes || [])[0] ||
    {};
  const currency =
    tenant.defaultCurrency || defaultSize?.currency || 'NGN';

  const viewModel = {
    isReal: true,
    id: subProduct._id,
    editHref: `/sub-products/${subProduct._id}/edit`,
    name: product.name || 'Sub-Product',
    type: product.type,
    subType: product.subType,
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
    material: product.material,
    packCount: product.packCount,
    shelfLifeDays: product.shelfLifeDays,
    description: product.description || product.shortDescription || '',
    status: subProduct.status,
    isPublished: !!subProduct.isPublished,
    sku: subProduct.sku || '',
    barcode: subProduct.barcode || '',
    stock: subProduct.availableStock,
    tenantName: tenant.businessName || tenant.name || '',
    revenueModel: tenant.revenueModel || '',
    markupPercentage: tenant.markupPercentage,
    commissionPercentage: tenant.commissionPercentage,
    currency,
    baseSellingPrice: subProduct.baseSellingPrice,
    salePrice: subProduct.salePrice,
    isOnSale: !!subProduct.isOnSale,
    sizes: (subProduct.sizes || []).map((s: any) => ({
      id: s._id,
      size: s.size,
      displayName: s.displayName || s.size,
      unitType: s.unitType,
      sellingPrice: s.sellingPrice,
      salePrice: s.salePrice,
      isOnSale: !!s.isOnSale,
      availability: s.availability,
      stock: s.availableStock ?? s.stockQuantity,
      sku: s.sku || '',
      barcode: s.barcode || '',
      isDefault: !!s.isDefault,
    })),
    images: product.images || [],
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
          <SubProductDetailsSummary product={viewModel} />
          <ProductDetailsDescription product={viewModel} />
        </div>
      </div>
    </div>
  );
}