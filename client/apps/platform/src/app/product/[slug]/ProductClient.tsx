"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import BreadcrumbProduct from "@/components/Breadcrumb/BreadcrumbProduct";
import LoadingSpinner from "@/components/loader/LoadingSpinner";
import type { ProductType } from "@/types/product.types";
import * as Icon from "react-icons/pi";
import { AnnouncementBanner, PlacementBanner } from "@/components/Banner";
import { viewItemEvent } from "@/lib/gtag";

// ProductDetail is imported statically on purpose. It used to be a
// next/dynamic() chunk to keep Swiper out of the initial bundle, but a lazy
// chunk only ever renders its `loading` skeleton on the server — so the page's
// entire indexable body (description, specs, reviews) was missing from the HTML.
// It is also the above-the-fold content, so deferring it hurt LCP anyway.
import ProductDetail from "@/components/Product/Detail";

// Below the fold and not indexable content — still deferred.
const RecentlyViewed    = dynamic(() => import("@/components/Shop/RecentlyViewed"));

// Prices, discounts and stock are all computed server-side per request off the
// current SubProduct rows, so any client-side cache stales the moment a tenant
// edits a price. A 5-minute in-memory cache used to keep the old price visible
// on every navigation back to a product until it expired — the exact bug the
// details page had. The initial payload from the server already renders the
// full detail page; the only remaining fetch is the background related-
// products top-up, which we still keep uncached below.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiResponse {
  success: boolean;
  data?: { product: any; relatedProducts?: ProductType[] };
  products?: any[];
  message?: string;
}

/** Background top-up when the product response carried no related products. */
function fetchRelated(
  _slug: string,
  product: any,
  onLoaded: (related: ProductType[]) => void,
) {
  // no-store: the related endpoint recomputes each card's priceRange per
  // request off live SubProduct rows, same as the detail payload. A cached
  // response would show pre-edit prices in the "You May Also Like" carousel
  // even after the details price above had refreshed.
  fetch(`${API_URL}/api/products/${product._id}/related?limit=8`, { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d) return;
      let fetchedRelated: ProductType[] = [];
      if (d.success && d.data?.products?.products) fetchedRelated = d.data.products.products;
      else if (d.success && d.data?.products) fetchedRelated = d.data.products;
      if (fetchedRelated.length > 0) onLoaded(fetchedRelated);
    })
    .catch(() => {/* non-critical */});
}

export default function ProductClient({
  slug,
  initialProduct = null,
  initialRelated = [],
}: {
  slug: string;
  /**
   * The product the server component already fetched for <head> metadata and
   * JSON-LD. Seeding it here is what puts the description, specs and reviews in
   * the server HTML — without it the first paint was "Loading product
   * details...", so JS-less crawlers indexed an empty body under rich meta tags.
   */
  initialProduct?: any;
  initialRelated?: ProductType[];
}) {
  const [productData, setProductData] = useState<any>(initialProduct);
  const [relatedProducts, setRelatedProducts] = useState<ProductType[]>(initialRelated);
  const [loading, setLoading] = useState(!initialProduct);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!slug) return;

    // Already server-rendered — don't refetch the product on mount. Related
    // products are still topped up below when the server response lacked them.
    // The server render is a fresh, uncached fetch (see page.tsx), so the
    // price/discount/stock we already hold is always current for this request.
    if (initialProduct) {
      if (initialRelated.length === 0 && initialProduct?._id) {
        fetchRelated(slug, initialProduct, setRelatedProducts);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // No `next.revalidate` — prices, discounts and stock all recompute
      // server-side per request off live SubProduct rows, and no
      // revalidatePath/revalidateTag hook fires when they change. A cached
      // response here served the pre-edit price until the window rolled over.
      const response = await fetch(`${API_URL}/api/products/slug/${slug}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiResponse = await response.json();

      let product: any = null;
      let related: ProductType[] = [];

      if (data.success && data.data?.product) {
        product = data.data.product;
        related = data.data.relatedProducts || [];
      } else if (data.success && data.data) {
        product = data.data;
      } else if (Array.isArray(data.products) && data.products.length > 0) {
        product = data.products[0];
      } else if (Array.isArray(data) && (data as any).length > 0) {
        product = (data as any)[0];
      } else {
        setError("Product data format not recognized");
        setLoading(false);
        return;
      }

      setProductData(product);
      setRelatedProducts(related);
      setLoading(false);

      // If the main response didn't include related products, fetch them in the background
      // without blocking the UI
      if (related.length === 0 && product?._id) {
        fetchRelated(slug, product, setRelatedProducts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product. Please try again later.");
      setProductData(null);
      setLoading(false);
    }
  }, [slug, initialProduct, initialRelated]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

  const viewItemFired = useRef(false);
  useEffect(() => {
    if (!productData || loading || viewItemFired.current) return;
    viewItemFired.current = true;
    const price = productData.priceRange?.min ?? productData.price ?? 0;
    viewItemEvent({
      items: [{
        item_id: productData.sku ?? productData.slug ?? productData._id,
        item_name: productData.name,
        item_category: productData.category?.name ?? productData.type,
        item_category2: productData.subCategory,
        item_variant: undefined,
        price,
        quantity: 1,
      }],
      value: price,
    });
  }, [productData, loading]);

  if (loading) {
    return (
      <>
        <AnnouncementBanner placement="header" layout="static" variant="info" />
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white">
          <LoadingSpinner variant="pulse" color="rose" size="xl" text="Loading product details..." />
        </div>
      </>
    );
  }

  if (error || !productData) {
    return (
      <>
        <AnnouncementBanner placement="header" layout="static" variant="info" />
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon.PiWarningCircle size={40} className="text-red-700" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {error ? "Something went wrong" : "Product Not Found"}
            </h2>
            <p className="text-gray-600 mb-6">
              {error || "The product you're looking for doesn't exist or has been removed."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-lg font-semibold hover:from-red-800 hover:to-red-950 transition-all shadow-md"
              >
                <Icon.PiArrowClockwise size={20} />
                Try Again
              </button>
              <a
                href="/shop"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-red-200 text-red-800 rounded-lg font-semibold hover:border-red-700 hover:bg-red-50 transition-colors"
              >
                <Icon.PiArrowLeft size={20} />
                Continue Shopping
              </a>
            </div>
          </div>
        </div>
      </>
    );
  }

  const hasActiveDiscount = !!(productData.discount?.savings > 0);
  const currentProductData = {
    _id: productData._id,
    name: productData.name,
    type: productData.type,
    slug: productData.slug,
    images: productData.images,
    priceRange: productData.priceRange,
    price: productData.priceRange?.min ?? 0,
    originPrice: hasActiveDiscount
      ? (productData.discount.originalPrice ?? productData.priceRange?.min ?? 0)
      : (productData.priceRange?.min ?? 0),
    discount: productData.discount,
    brand: productData.brand,
    abv: productData.abv,
    sale: hasActiveDiscount,
    new: productData.new,
    availableAt: productData.availableAt,
    thumbImage: productData.thumbImage,
    primaryImage: productData.primaryImage,
  };

  return (
    <>
      <AnnouncementBanner placement="header" layout="static" variant="info" />
      <div className="container mx-auto px-4 pt-6">
        <BreadcrumbProduct data={productData} productPage="default" productId={slug} />
      </div>
      <div className="container mx-auto px-4 pb-2">
        <PlacementBanner placement="product_page" variant="hero" limit={1} />
      </div>
      <ProductDetail productData={productData} relatedProducts={relatedProducts} />
      <RecentlyViewed productId={productData._id} currentProduct={currentProductData} />
    </>
  );
}
