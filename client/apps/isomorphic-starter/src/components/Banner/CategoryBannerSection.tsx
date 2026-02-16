'use client';

import CategoryBanner from '@/components/Banner/CategoryBanner';

export default function CategoryBannerSection() {
  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        {/* Hero Layout - For category pages */}
        <CategoryBanner
          categorySlug="whiskey"
          placement="category_top"
          layout="hero"
          showSubcategories={true}
          showStats={true}
        />

        {/* Card Layout - For grid displays */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
          <CategoryBanner
            categorySlug="wine"
            placement="category_top"
            layout="card"
            showStats={true}
          />
          <CategoryBanner
            categorySlug="beer"
            placement="category_top"
            layout="card"
            showStats={true}
          />
          <CategoryBanner
            categorySlug="vodka"
            placement="category_top"
            layout="card"
            showStats={true}
          />
          <CategoryBanner
            categorySlug="gin"
            placement="category_top"
            layout="card"
            showStats={true}
          />
        </div>

        {/* Minimal Layout - For compact displays */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <CategoryBanner
            categorySlug="rum"
            placement="category_top"
            layout="minimal"
            showStats={true}
          />
          <CategoryBanner
            categorySlug="brandy"
            placement="category_top"
            layout="minimal"
            showStats={true}
          />
          <CategoryBanner
            categorySlug="tequila"
            placement="category_top"
            layout="minimal"
            showStats={true}
          />
        </div>

        {/* Sidebar Layout - For sidebars */}
        <div className="w-[300px] mt-6">
          <CategoryBanner
            categorySlug="cocktails"
            placement="sidebar"
            layout="sidebar"
            showStats={true}
          />
        </div>
      </div>
    </section>
  );
}
