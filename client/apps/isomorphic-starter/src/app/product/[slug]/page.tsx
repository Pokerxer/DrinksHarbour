'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import BreadcrumbProduct from '@/components/Breadcrumb/BreadcrumbProduct';
import ProductDetail from '@/components/Product/Detail';
import type { ProductType } from '@/types/product.types';
import * as Icon from 'react-icons/pi';

import { AnnouncementBanner } from '@/components/Banner';

interface ApiResponse {
  success: boolean;
  data?: {
    product: any;
    relatedProducts?: ProductType[];
  };
  products?: any[];
  message?: string;
}

interface RelatedApiResponse {
  success: boolean;
  data?: {
    products?: ProductType[];
  };
  message?: string;
}

const Product = () => {
  const params = useParams();
  const slug = params.slug as string;
  const [productData, setProductData] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!slug) return;

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/products/slug/${slug}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ApiResponse = await response.json();

      if (data.success && data.data?.product) {
        setProductData(data.data.product);
        setRelatedProducts(data.data.relatedProducts || []);
      } else if (data.success && data.data) {
        setProductData(data.data);
      } else if (Array.isArray(data.products) && data.products.length > 0) {
        setProductData(data.products[0]);
      } else if (Array.isArray(data) && data.length > 0) {
        setProductData(data[0]);
      } else {
        console.warn('Unexpected API response structure:', data);
        setError('Product data format not recognized');
        setProductData(null);
      }
    } catch (err) {
      console.error('Error fetching product:', err);
      setError(err instanceof Error ? err.message : 'Failed to load product. Please try again later.');
      setProductData(null);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const fetchRelatedProducts = useCallback(async (productId: string) => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    try {
      const response = await fetch(`${API_URL}/api/products/${productId}/related?limit=8`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: any = await response.json();

      if (data.success && data.data?.products?.products) {
        setRelatedProducts(data.data.products.products);
      } else if (data.success && data.data?.products) {
        setRelatedProducts(data.data.products);
      }
    } catch (err) {
      console.error('Error fetching related products:', err);
    }
  }, []);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  useEffect(() => {
    if (productData?._id && relatedProducts.length === 0) {
      fetchRelatedProducts(productData._id);
    }
  }, [productData, relatedProducts.length, fetchRelatedProducts]);

  if (loading) {
    return (
      <>
        <AnnouncementBanner
          placement="header"
          layout="static"
          variant="info"
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-black rounded-full border-t-transparent animate-spin"></div>
            </div>
            <p className="text-gray-600 font-medium">Loading product details...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !productData) {
    return (
      <>
        <AnnouncementBanner
          placement="header"
          layout="static"
          variant="info"
        />
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Icon.PiWarningCircle size={40} className="text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">
              {error ? 'Something went wrong' : 'Product Not Found'}
            </h2>
            <p className="text-gray-600 mb-6">
              {error || "The product you're looking for doesn't exist or has been removed."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors"
              >
                <Icon.PiArrowClockwise size={20} />
                Try Again
              </button>
              <a
                href="/shop"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:border-black hover:text-black transition-colors"
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

  return (
    <>
      <AnnouncementBanner
        placement="header"
        layout="static"
        variant="info"
      />
      
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-6">
        <BreadcrumbProduct data={productData} productPage="default" productId={slug} />
      </div>

      {/* Product Details */}
      <ProductDetail productData={productData} relatedProducts={relatedProducts} />
    </>
  );
};

export default Product;
