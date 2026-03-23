import React from 'react';
import ProductCard from '@/components/Product/Card';
import { ProductCardSkeleton } from '@/components/Product/Card/Skeleton';

interface ProductGridProps {
  products: any[];
  layoutCol: number;
  productStyle: string;
  isLoading?: boolean;
}

const ProductGrid: React.FC<ProductGridProps> = ({ products, layoutCol, isLoading = false }) => {
  // Always 2 columns on mobile, then responsive for larger screens
  const gridClass = 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

  if (isLoading) {
    return (
      <div 
        className={`grid ${gridClass} gap-3 sm:gap-5 mt-5 sm:mt-7`}
        role="list"
        aria-label="Loading products"
      >
        <ProductCardSkeleton count={6} layout="grid" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="col-span-full text-center py-12 sm:py-20 animate-fade-in px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-20 sm:h-20 bg-gray-100 rounded-full mb-4 sm:mb-6">
          <svg className="w-7 h-7 sm:w-10 sm:h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
        </div>
        <h3 className="text-lg sm:text-2xl font-semibold text-gray-900 mb-2 sm:mb-3">No products found</h3>
        <p className="text-gray-600 text-sm sm:text-base max-w-md mx-auto">Try adjusting your filters or search criteria to find what you're looking for.</p>
      </div>
    );
  }

  return (
    <div 
      className={`list-product hide-product-sold grid ${gridClass} gap-3 sm:gap-5 mt-5 sm:mt-7`} 
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
          <ProductCard data={item as any} type="grid" />
        </div>
      ))}
    </div>
  );
};

export default ProductGrid;
