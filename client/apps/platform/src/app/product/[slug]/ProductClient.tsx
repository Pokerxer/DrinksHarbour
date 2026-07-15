"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import BreadcrumbProduct from "@/components/Breadcrumb/BreadcrumbProduct";
import LoadingSpinner from "@/components/loader/LoadingSpinner";
import type { ProductType } from "@/types/product.types";
import * as Icon from "react-icons/pi";
import { AnnouncementBanner, PlacementBanner } from "@/components/Banner";

// Defer heavy components — ProductDetail pulls in Swiper + all modules
const ProductDetail = dynamic(() => import("@/components/Product/Detail"), {
  loading: () => (
    <div className="container mx-auto px-4 py-10 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-gray-100 rounded-2xl" />
        <div className="space-y-4">
          <div className="h-8 bg-gray-100 rounded w-3/4" />
          <div className="h-5 bg-gray-100 rounded w-1/2" />
          <div className="h-12 bg-gray-100 rounded" />
          <div className="h-12 bg-gray-100 rounded w-2/3" />
        </div>
      </div>
    </div>
  ),
});
const RecentlyViewed    = dynamic(() => import("@/components/Shop/RecentlyViewed"));
const ProductReviews    = dynamic(() => import("@/components/Product/ProductReviews"));

// ─── In-memory cache: product data keyed by slug, 5 min TTL ─────────────────
const _productCache = new Map<string, { product: any; related: ProductType[]; ts: number }>();
const PRODUCT_CACHE_TTL = 5 * 60_000;

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface ApiResponse {
  success: boolean;
  data?: { product: any; relatedProducts?: ProductType[] };
  products?: any[];
  message?: string;
}

export default function ProductClient({ slug }: { slug: string }) {
  const [productData, setProductData] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = useCallback(async () => {
    if (!slug) return;

    // Serve from cache if fresh
    const cached = _productCache.get(slug);
    if (cached && Date.now() - cached.ts < PRODUCT_CACHE_TTL) {
      setProductData(cached.product);
      setRelatedProducts(cached.related);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/products/slug/${slug}`, {
        next: { revalidate: 300 },
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

      // Cache with what we have so far
      _productCache.set(slug, { product, related, ts: Date.now() });

      // If the main response didn't include related products, fetch them in the background
      // without blocking the UI
      if (related.length === 0 && product?._id) {
        fetch(`${API_URL}/api/products/${product._id}/related?limit=8`)
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (!d) return;
            let fetchedRelated: ProductType[] = [];
            if (d.success && d.data?.products?.products) fetchedRelated = d.data.products.products;
            else if (d.success && d.data?.products) fetchedRelated = d.data.products;
            if (fetchedRelated.length > 0) {
              setRelatedProducts(fetchedRelated);
              // Update cache with related products
              _productCache.set(slug, { product, related: fetchedRelated, ts: Date.now() });
            }
          })
          .catch(() => {/* non-critical */});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load product. Please try again later.");
      setProductData(null);
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { loadProduct(); }, [loadProduct]);

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
      <ProductReviews productId={productData._id} />
      <RecentlyViewed productId={productData._id} currentProduct={currentProductData} />
    </>
  );
}
