import React from 'react';

interface ProductCardSkeletonProps {
  count?: number;
  layout?: 'grid' | 'list';
}

export const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({ 
  count = 1,
  layout = 'grid'
}) => {
  if (layout === 'list') {
    return (
      <>
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="flex items-start gap-4 p-4 bg-white rounded-xl animate-pulse">
            <div className="w-24 h-32 sm:w-32 sm:h-40 bg-gray-200 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
              <div className="h-8 bg-gray-200 rounded w-1/3" />
              <div className="flex gap-2 pt-2">
                <div className="h-8 w-20 bg-gray-200 rounded" />
                <div className="h-8 w-8 bg-gray-200 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-2xl overflow-hidden animate-pulse">
          {/* Image Skeleton */}
          <div className="aspect-[3/4] bg-gray-200 relative">
            {/* Badge Skeleton */}
            <div className="absolute top-2 left-2 w-16 h-5 bg-gray-300 rounded-full" />
          </div>
          
          {/* Content Skeleton */}
          <div className="p-3 sm:p-4 space-y-3">
            {/* Category */}
            <div className="h-3 bg-gray-200 rounded w-1/3" />
            
            {/* Title */}
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
            
            {/* Price */}
            <div className="flex items-center gap-2 pt-1">
              <div className="h-5 bg-gray-200 rounded w-20" />
              <div className="h-4 bg-gray-300 rounded w-16" />
            </div>
            
            {/* Vendor Count */}
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
      ))}
    </>
  );
};

export default ProductCardSkeleton;
