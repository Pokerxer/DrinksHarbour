'use client';

import React from 'react';
import PageLayout from '@/components/Layout/PageLayout';

// Banner Components
import {
  HeroBanner,
  PromotionalBanner,
  CategoryBanner,
  AnnouncementBanner,
  SeasonalBanner,
  ProductBanner
} from '@/components/Banner';

export default function BannersDemoPage() {
  return (
    <PageLayout
      showAnnouncement={true}
      announcementVariant="info"
      announcementLayout="static"
    >
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Banner Components Demo
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              This page demonstrates all the dynamic banner components integrated into the DrinksHarbour application.
              Each banner type fetches data from the server API and renders beautifully designed layouts.
            </p>
          </div>

          {/* Section 1: Announcement Banner */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              1. Announcement Banner
            </h2>
            <p className="text-gray-600 mb-4">
              Used for shipping info, promo codes, and alerts. Replaces the old static BannerTop component.
            </p>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-700">Marquee Layout (Scrolling)</h3>
              <AnnouncementBanner
                placement="header"
                layout="marquee"
                variant="promo"
              />

              <h3 className="text-lg font-semibold text-gray-700 mt-6">Static Layout</h3>
              <AnnouncementBanner
                placement="header"
                layout="static"
                variant="success"
              />

              <h3 className="text-lg font-semibold text-gray-700 mt-6">Alert Layout</h3>
              <AnnouncementBanner
                placement="header"
                layout="alert"
                variant="warning"
              />
            </div>
          </section>

          {/* Section 2: Hero Banner */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              2. Hero Banner
            </h2>
            <p className="text-gray-600 mb-4">
              Full-width carousel banners for homepage hero sections. Supports animations, auto-play, and mobile images.
            </p>
            <HeroBanner
              placement="home_hero"
              limit={5}
              autoPlay={true}
              showControls={true}
              showIndicators={true}
            />
          </section>

          {/* Section 3: Promotional Banner */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              3. Promotional Banner
            </h2>
            <p className="text-gray-600 mb-4">
              Sales, discounts, and special offers with countdown timers and discount badges.
            </p>

            <h3 className="text-lg font-semibold text-gray-700 mb-4">Overlay Layout</h3>
            <PromotionalBanner
              placement="home_secondary"
              layout="overlay"
              showCountdown={true}
              columns={2}
            />

            <h3 className="text-lg font-semibold text-gray-700 mt-8 mb-4">Card Layout</h3>
            <PromotionalBanner
              placement="home_secondary"
              layout="card"
              showCountdown={true}
              columns={3}
            />
          </section>

          {/* Section 4: Category Banner */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              4. Category Banner
            </h2>
            <p className="text-gray-600 mb-4">
              Dynamic category banners with product counts and subcategory navigation.
            </p>

            <h3 className="text-lg font-semibold text-gray-700 mb-4">Hero Layout</h3>
            <CategoryBanner
              categorySlug="whiskey"
              placement="category_top"
              layout="hero"
              showSubcategories={true}
              showStats={true}
            />

            <h3 className="text-lg font-semibold text-gray-700 mt-8 mb-4">Card Layout</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          </section>

          {/* Section 5: Seasonal Banner */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              5. Seasonal Banner
            </h2>
            <p className="text-gray-600 mb-4">
              Holiday and event banners with decorative themes and animations.
            </p>

            <SeasonalBanner
              placement="home_secondary"
              theme="christmas"
              layout="hero"
              showDecorations={true}
              showCountdown={true}
            />

            <h3 className="text-lg font-semibold text-gray-700 mt-8 mb-4">Card Layout</h3>
            <SeasonalBanner
              placement="home_secondary"
              theme="blackfriday"
              layout="card"
              showDecorations={true}
              showCountdown={true}
            />
          </section>

          {/* Section 6: Product Banner */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              6. Product Banner
            </h2>
            <p className="text-gray-600 mb-4">
              Product and brand-specific banners for product pages.
            </p>

            <h3 className="text-lg font-semibold text-gray-700 mb-4">Featured Layout</h3>
            <ProductBanner
              placement="product_page"
              layout="featured"
              showReviews={true}
              showPrice={true}
              showAddToCart={true}
            />

            <h3 className="text-lg font-semibold text-gray-700 mt-8 mb-4">Brand Layout</h3>
            <ProductBanner
              placement="product_page"
              layout="brand"
              brandSlug="moet-hennessy"
            />
          </section>

          {/* Integration Examples */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              Integration in Real Pages
            </h2>
            <p className="text-gray-600 mb-4">
              The banners are integrated into the following pages:
            </p>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Homepage</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Uses: AnnouncementBanner (marquee), HeroBanner, PromotionalBanner
                </p>
                <a
                  href="/"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  View Homepage
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Shop Page</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Uses: AnnouncementBanner, CategoryBanner, PromotionalBanner
                </p>
                <a
                  href="/shop"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  View Shop
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Product Page</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Uses: AnnouncementBanner, ProductBanner, PromotionalBanner
                </p>
                <a
                  href="/product/sample-product"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800"
                >
                  View Product
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              </div>
            </div>
          </section>

          {/* API Integration */}
          <section>
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              API Integration
            </h2>
            <p className="text-gray-600 mb-4">
              All banners fetch data from the server API. The main endpoints are:
            </p>

            <div className="bg-gray-900 rounded-xl p-6 overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="pb-3 font-semibold">Endpoint</th>
                    <th className="pb-3 font-semibold">Description</th>
                    <th className="pb-3 font-semibold">Example</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300">
                  <tr className="border-b border-gray-800">
                    <td className="py-3 font-mono text-sm">GET /api/banners/placement/:placement</td>
                    <td className="py-3">Fetch banners by placement</td>
                    <td className="py-3">/api/banners/placement/home_hero</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 font-mono text-sm">GET /api/banners/:id</td>
                    <td className="py-3">Fetch single banner</td>
                    <td className="py-3">/api/banners/12345</td>
                  </tr>
                  <tr className="border-b border-gray-800">
                    <td className="py-3 font-mono text-sm">POST /api/banners/:id/impression</td>
                    <td className="py-3">Track banner impression</td>
                    <td className="py-3">-</td>
                  </tr>
                  <tr>
                    <td className="py-3 font-mono text-sm">POST /api/banners/:id/click</td>
                    <td className="py-3">Track banner click</td>
                    <td className="py-3">-</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </PageLayout>
  );
}
