'use client';

import React from 'react';

interface CategoryBannerProps {
  categorySlug?: string;
  placement?: string;
  layout?: string;
  showSubcategories?: boolean;
  showStats?: boolean;
  className?: string;
  [key: string]: any;
}

const CategoryBanner: React.FC<CategoryBannerProps> = (props) => {
  return (
    <div className={props.className || ''}>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold">Shop</h1>
      </div>
    </div>
  );
};

export default CategoryBanner;
