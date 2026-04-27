"use client";

import React, { useEffect, useState, useCallback } from "react";
import BreadcrumbProduct from "@/components/Breadcrumb/BreadcrumbProduct";
import ProductDetail from "@/components/Product/Detail";
import RecentlyViewed from "@/components/Shop/RecentlyViewed";
import LoadingSpinner from "@/components/loader/LoadingSpinner";
import type { ProductType } from "@/types/product.types";
import * as Icon from "react-icons/pi";
import { AnnouncementBanner } from "@/components/Banner";

interface ApiResponse {
  success: boolean;
  data?: {
    product: any;
    relatedProducts?: ProductType[];
  };
  products?: any[];
  message?: string;
}

export default function ProductClient({ slug }: { slug: string }) {
  const [productData, setProductData] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!slug) return;
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_URL}/api/products/slug/${slug}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiResponse = await response.json();
      if (data.success && data.data?.product) {
        setProductData(data.data.product);
        setRelatedProducts(data.data.relatedProducts || []);
      } else if (data.success && data.data) {
        setProductData(data.data);
      } else if (Array.isArray(data.products) && data.products.length > 0) {
        setProductData(data.products[0]);
      } else if (Array.isArray(data) && (data as any).length > 0) {
        setProductData((data as any)[0]);
      } else {
        setError("Product data format not recognized");
        setProductData(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load product. Please try again later.",
      );
      setProductData(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchRelatedProducts = useCallback(async (productId: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "";
    try {
      const response = await fetch(`${API_URL}/api/products/${productId}/related?limit=8`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;
      const data: any = await response.json();
      if (data.success && data.data?.products?.products) {
        setRelatedProducts(data.data.products.products);
      } else if (data.success && data.data?.products) {
        setRelatedProducts(data.data.products);
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);
  useEffect(() => {
    if (productData?._id) fetchRelatedProducts(productData._id);
  }, [productData, fetchRelatedProducts]);

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
      <ProductDetail productData={productData} relatedProducts={relatedProducts} />
      <RecentlyViewed productId={productData._id} currentProduct={currentProductData} />
    </>
  );
}
