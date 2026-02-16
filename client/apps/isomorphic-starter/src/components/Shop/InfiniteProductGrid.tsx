'use client';

import React, { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import ProductCard from '@/components/Product/Card';
import { ProductCardSkeleton } from '@/components/Product/Card/Skeleton';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import * as Icon from 'react-icons/pi';

interface Product {
  _id: string;
  id?: string;
  name: string;
  slug: string;
  price: number;
  originPrice?: number;
  sale?: boolean;
  discount?: number;
  thumbImage?: string[];
  primaryImage?: { url: string };
  images?: Array<{ url: string }>;
  averageRating?: number;
  reviewCount?: number;
  category?: { name: string; slug: string };
  [key: string]: any;
}

interface InfiniteProductGridProps {
  fetchUrl: string;
  initialLimit?: number;
  loadMoreLimit?: number;
  layoutCol?: number;
  className?: string;
}

const InfiniteProductGrid: React.FC<InfiniteProductGridProps> = ({
  fetchUrl,
  initialLimit = 12,
  loadMoreLimit = 12,
  layoutCol = 4,
  className = '',
}) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async (page: number) => {
    const limit = page === 1 ? initialLimit : loadMoreLimit;
    const offset = (page - 1) * loadMoreLimit;
    
    const url = new URL(fetchUrl, window.location.origin);
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('offset', String(offset));
    
    try {
      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const data = await response.json();
      
      let products: Product[] = [];
      let total = 0;
      let hasMore = false;
      
      if (data.success && data.data?.products) {
        products = data.data.products;
        total = data.data.pagination?.total || products.length;
        hasMore = products.length === loadMoreLimit && (data.data.pagination?.page || page) * loadMoreLimit < total;
      } else if (data.success && data.data?.data) {
        products = data.data.data;
        total = data.data.pagination?.total || products.length;
        hasMore = products.length === loadMoreLimit && (data.data.pagination?.page || page) * loadMoreLimit < total;
      } else if (Array.isArray(data.products)) {
        products = data.products;
        total = data.products.length;
        hasMore = products.length === loadMoreLimit;
      } else if (Array.isArray(data)) {
        products = data;
        total = data.length;
        hasMore = products.length === loadMoreLimit;
      }
      
      return { items: products, hasMore, total };
    } catch (error) {
      throw error;
    }
  }, [fetchUrl, initialLimit, loadMoreLimit]);

  const {
    items: products,
    loading,
    error,
    hasMore,
    isLoadingMore,
    refresh,
  } = useInfiniteScroll<Product>(fetchProducts, {
    threshold: 200,
    enabled: true,
  });

  const getGridClass = (col: number): string => {
    const gridMap: Record<number, string> = {
      3: 'lg:grid-cols-3',
      4: 'lg:grid-cols-4',
      5: 'lg:grid-cols-5',
    };
    return gridMap[col] || 'lg:grid-cols-4';
  };

  const gridClass = getGridClass(layoutCol);

  if (loading && products.length === 0) {
    return (
      <div 
        className={`grid ${gridClass} sm:grid-cols-3 grid-cols-2 sm:gap-[30px] gap-[20px] mt-7`}
        role="list"
        aria-label="Loading products"
      >
        <ProductCardSkeleton count={initialLimit} layout="grid" />
      </div>
    );
  }

  if (error && products.length === 0) {
    return (
      <div className="col-span-full text-center py-20 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-6">
          <Icon.PiWarning size={40} className="text-red-500" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-3">Failed to load products</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={refresh}
          className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Icon.PiArrowClockwise size={20} />
          Try Again
        </button>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="col-span-full text-center py-20 animate-fade-in">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-6">
          <Icon.PiPackage size={40} className="text-gray-400" />
        </div>
        <h3 className="text-2xl font-semibold text-gray-900 mb-3">No products found</h3>
        <p className="text-gray-600 max-w-md mx-auto">Try adjusting your filters or search criteria to find what you're looking for.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div 
        className={`list-product hide-product-sold grid ${gridClass} sm:grid-cols-3 grid-cols-2 sm:gap-[30px] gap-[20px] mt-7`} 
        role="list" 
        aria-label="Product list"
      >
        {products.map((item, index) => (
          <div 
            key={`${item.id || item._id || index}-${index}`} 
            role="listitem"
            className="animate-fade-in-up"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ProductCard data={item} type="grid" />
          </div>
        ))}
      </div>

      {/* Load More Trigger / Loading Indicator */}
      <div ref={loadMoreRef} className="mt-10">
        {isLoadingMore && (
          <div className="flex justify-center items-center gap-2 py-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Icon.PiSpinner size={24} className="text-gray-600" />
            </motion.div>
            <span className="text-gray-600">Loading more products...</span>
          </div>
        )}

        {!isLoadingMore && hasMore && (
          <div className="text-center py-4">
            <span className="text-gray-400 text-sm">Scroll to load more</span>
          </div>
        )}

        {!hasMore && products.length > 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center gap-2 text-gray-500">
              <Icon.PiCheckCircle size={20} />
              <span>You've reached the end</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InfiniteProductGrid;
