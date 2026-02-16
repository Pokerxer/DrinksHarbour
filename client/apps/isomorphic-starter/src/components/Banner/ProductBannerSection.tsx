'use client';

import ProductBanner from '@/components/Banner/ProductBanner';

export default function ProductBannerSection() {
  return (
    <div className="space-y-8">
      {/* Hero Layout - Featured Product */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Hero Layout - Featured Product</h3>
        <ProductBanner
          placement="product_page"
          layout="hero"
          showReviews={true}
          showPrice={true}
          showAddToCart={true}
        />
      </section>

      {/* Featured Layout - Split Display */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Featured Layout - Split Display</h3>
        <ProductBanner
          placement="product_page"
          layout="featured"
          showReviews={true}
          showPrice={true}
          showAddToCart={true}
        />
      </section>

      {/* Brand Layout - Brand Story */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Brand Layout - Brand Story</h3>
        <ProductBanner
          placement="product_page"
          layout="brand"
          brandSlug="moet-hennessy"
        />
      </section>

      {/* Upsell Layout - Cart Upsell */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Upsell Layout - Cart Upsell</h3>
        <ProductBanner
          placement="product_page"
          layout="upsell"
          showPrice={true}
        />
      </section>

      {/* Sidebar Layout */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Sidebar Layout</h3>
        <div className="max-w-xs">
          <ProductBanner
            placement="product_page"
            layout="sidebar"
            showReviews={true}
            showPrice={true}
            showAddToCart={false}
          />
        </div>
      </section>

      {/* Product-Specific Banner */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Product-Specific Banner</h3>
        <ProductBanner
          placement="product_page"
          productId="some-product-id"
          layout="hero"
          showReviews={true}
          showPrice={true}
        />
      </section>

      {/* Brand-Specific Banner */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Brand-Specific Banner</h3>
        <ProductBanner
          placement="product_page"
          brandSlug="jack-daniels"
          layout="brand"
        />
      </section>
    </div>
  );
}
