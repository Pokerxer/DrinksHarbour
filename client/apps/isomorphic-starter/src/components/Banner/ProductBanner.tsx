'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface ProductBannerProps {
  placement?: string;
  brandSlug?: string;
  productId?: string;
  layout?: 'hero' | 'featured' | 'brand' | 'upsell' | 'sidebar';
  showReviews?: boolean;
  showPrice?: boolean;
  showAddToCart?: boolean;
  limit?: number;
}

interface BannerData {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: string;
  placement: string;
  targetProduct?: {
    _id: string;
    name: string;
    slug: string;
    price: number;
    comparePrice?: number;
    images?: Array<{ url: string; alt?: string }>;
    rating?: number;
    reviewCount?: number;
    inStock?: boolean;
    sku?: string;
    shortDescription?: string;
  };
  targetBrand?: {
    _id: string;
    name: string;
    slug: string;
    logo?: { url: string; alt?: string };
    description?: string;
  };
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  backgroundColor?: string;
  textColor?: string;
  overlayOpacity?: number;
  textAlignment?: string;
  contentPosition?: string;
  image: {
    url: string;
    alt?: string;
  };
  mobileImage?: {
    url: string;
    alt?: string;
  };
  tags?: string[];
}

interface ProductData {
  _id: string;
  name: string;
  slug: string;
  type?: string;
  shortDescription?: string;
  description?: string;
  price: number;
  comparePrice?: number;
  images?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  sku?: string;
  brand?: {
    _id: string;
    name: string;
    slug: string;
    logo?: { url: string; alt?: string };
  };
  category?: {
    _id: string;
    name: string;
    slug: string;
  };
  tags?: string[];
}

const ProductBanner: React.FC<ProductBannerProps> = ({
  placement = 'product_page',
  brandSlug,
  productId,
  layout = 'hero',
  showReviews = true,
  showPrice = true,
  showAddToCart = true,
  limit = 1
}) => {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);

  const fetchBannerData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch banner
      let bannerUrl = `http://localhost:5001/api/banners/placement/${placement}?limit=${limit}`;
      if (brandSlug) {
        bannerUrl = `http://localhost:5001/api/banners?brand=${brandSlug}&type=product&limit=1`;
      }
      if (productId) {
        bannerUrl = `http://localhost:5001/api/banners?product=${productId}&type=product&limit=1`;
      }
      
      const response = await fetch(bannerUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.length > 0) {
          const bannerData = data.data[0];
          setBanner(bannerData);
          
          // Fetch product details if banner has target product
          if (bannerData.targetProduct) {
            const productResponse = await fetch(`http://localhost:5001/api/products/${bannerData.targetProduct._id}`);
            if (productResponse.ok) {
              const productData = await productResponse.json();
              if (productData.success) {
                setProduct(productData.data);
              }
            }
          }
        }
      }
    } catch (err) {
      setError('Error fetching banner data');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [placement, brandSlug, productId, limit]);

  useEffect(() => {
    fetchBannerData();
  }, [fetchBannerData]);

  const calculateDiscount = (price: number, comparePrice?: number) => {
    if (!comparePrice) return 0;
    return Math.round(((comparePrice - price) / comparePrice) * 100);
  };

  const renderStars = (rating: number) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const stars = [];
    
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      } else if (i === fullStars && hasHalfStar) {
        stars.push(
          <svg key={i} className="w-4 h-4 text-yellow-400" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2l2.395 4.855 5.338.776-3.865 3.766.913 5.32L10 13.408l-4.777 2.509.913-5.32-3.865-3.766 5.338-.776L10 2z" clipRule="evenodd" />
          </svg>
        );
      } else {
        stars.push(
          <svg key={i} className="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        );
      }
    }
    return stars;
  };

  const handleBannerClick = async (bannerId: string) => {
    if (!bannerId) return;
    try {
      await fetch(`http://localhost:5001/api/banners/${bannerId}/click`, {
        method: 'POST'
      });
    } catch (err) {
      console.error('Error tracking click:', err);
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className={`relative overflow-hidden rounded-2xl h-[300px] md:h-[400px] bg-gray-200 animate-pulse`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  // Hero Layout - Featured Product
  if (layout === 'hero') {
    const displayProduct = product || banner?.targetProduct;
    const displayPrice = displayProduct?.price || 0;
    const displayComparePrice = displayProduct?.comparePrice;
    const discount = calculateDiscount(displayPrice, displayComparePrice);
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const imageUrl = banner?.image?.url || displayProduct?.images?.[0]?.url;

    return (
      <section className="product-banner-hero py-8">
        <div className="relative rounded-2xl overflow-hidden h-[400px] md:h-[500px] lg:h-[600px]">
          {/* Background */}
          {imageUrl ? (
            <>
              <Image
                src={imageUrl}
                alt={banner?.title || displayProduct?.name || 'Product'}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/70 to-gray-900/30"></div>
            </>
          ) : (
            <div 
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${banner?.backgroundColor || '#1A1A2E'} 0%, ${banner?.backgroundColor || '#1A1A2E'}dd 100%)`
              }}
            ></div>
          )}

          {/* Product Images Gallery */}
          {displayProduct?.images && displayProduct.images.length > 1 && (
            <div className="absolute top-6 right-6 z-20 flex flex-col gap-2">
              {displayProduct.images.slice(0, 4).map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImage === index ? 'border-white' : 'border-white/50 hover:border-white'
                  }`}
                >
                  <Image
                    src={img.url}
                    alt={img.alt || `${displayProduct.name} ${index + 1}`}
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="relative z-10 h-full container mx-auto px-6 md:px-10 flex items-center">
            <div className="max-w-xl">
              {/* Brand Logo */}
              {banner?.targetBrand?.logo && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4"
                >
                  <Image
                    src={banner.targetBrand.logo.url}
                    alt={banner.targetBrand.name}
                    width={120}
                    height={60}
                    className="h-12 w-auto"
                  />
                </motion.div>
              )}

              {/* Discount Badge */}
              {discount > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500 text-white font-bold text-sm mb-4"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
                  </svg>
                  {discount}% OFF
                </motion.div>
              )}

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-white text-3xl md:text-4xl lg:text-5xl font-bold mb-3"
              >
                {banner?.title || displayProduct?.name || 'Featured Product'}
              </motion.h2>

              {/* Subtitle */}
              {banner?.subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-white/80 text-lg mb-4"
                >
                  {banner.subtitle}
                </motion.p>
              )}

              {/* Rating */}
              {showReviews && displayProduct?.rating && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="flex items-center gap-2 mb-4"
                >
                  <div className="flex gap-0.5">
                    {renderStars(displayProduct.rating)}
                  </div>
                  <span className="text-white/70 text-sm">
                    {displayProduct.rating.toFixed(1)} ({displayProduct.reviewCount || 0} reviews)
                  </span>
                </motion.div>
              )}

              {/* Description */}
              {displayProduct?.shortDescription && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-white/70 text-sm md:text-base mb-6 line-clamp-2"
                >
                  {displayProduct.shortDescription}
                </motion.p>
              )}

              {/* Price & CTA */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap items-center gap-4"
              >
                {showPrice && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-white text-3xl font-bold">
                      ₦{displayPrice.toLocaleString()}
                    </span>
                    {displayComparePrice && (
                      <span className="text-white/50 line-through text-lg">
                        ₦{displayComparePrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}

                {banner?.ctaText && (
                  <Link
                    href={banner.ctaLink || `/product/${displayProduct?.slug || banner._id}`}
                    onClick={() => handleBannerClick(banner._id)}
                    className={`inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold transition-all duration-300 transform hover:scale-105 ${
                      banner.ctaStyle === 'primary'
                        ? 'bg-white text-gray-900 hover:bg-gray-100'
                        : 'bg-red-500 text-white hover:bg-red-600'
                    }`}
                  >
                    {banner.ctaText}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </Link>
                )}
              </motion.div>

              {/* Stock Status */}
              {displayProduct?.inStock !== undefined && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className={`mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                    displayProduct.inStock
                      ? 'bg-green-500/20 text-green-300'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${
                    displayProduct.inStock ? 'bg-green-400' : 'bg-red-400'
                  }`}></span>
                  {displayProduct.inStock ? 'In Stock' : 'Out of Stock'}
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Featured Layout - Split Product Display
  if (layout === 'featured') {
    const displayProduct = product || banner?.targetProduct;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const imageUrl = banner?.image?.url || displayProduct?.images?.[0]?.url;

    return (
      <section className="product-banner-featured py-6">
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 items-center">
          {/* Image Side */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative aspect-square rounded-2xl overflow-hidden"
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={banner?.title || displayProduct?.name || 'Product'}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div className="absolute inset-0 bg-gray-200"></div>
            )}
            
            {/* Floating Badges */}
            {banner?.tags && (
              <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                {banner.tags.slice(0, 3).map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Content Side */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Brand */}
            {banner?.targetBrand && (
              <div className="flex items-center gap-3">
                {banner.targetBrand.logo && (
                  <Image
                    src={banner.targetBrand.logo.url}
                    alt={banner.targetBrand.name}
                    width={60}
                    height={30}
                    className="h-8 w-auto"
                  />
                )}
                <span className="text-gray-500 text-sm">{banner.targetBrand.name}</span>
              </div>
            )}

            {/* Title */}
            <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
              {banner?.title || displayProduct?.name}
            </h3>

            {/* Rating */}
            {showReviews && displayProduct?.rating && (
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5">
                  {renderStars(displayProduct.rating)}
                </div>
                <span className="text-gray-600 text-sm">
                  {displayProduct.rating.toFixed(1)} ({displayProduct.reviewCount || 0} reviews)
                </span>
              </div>
            )}

            {/* Price */}
            {showPrice && (
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold text-gray-900">
                  ₦{displayProduct?.price?.toLocaleString() || 0}
                </span>
                {displayProduct?.comparePrice && (
                  <span className="text-gray-400 line-through text-xl">
                    ₦{displayProduct.comparePrice.toLocaleString()}
                  </span>
                )}
                {calculateDiscount(displayProduct?.price || 0, displayProduct?.comparePrice) > 0 && (
                  <span className="px-2 py-1 rounded bg-red-100 text-red-600 text-sm font-semibold">
                    Save {calculateDiscount(displayProduct?.price || 0, displayProduct?.comparePrice)}%
                  </span>
                )}
              </div>
            )}

            {/* Description */}
            {displayProduct?.shortDescription && (
              <p className="text-gray-600 leading-relaxed">
                {displayProduct.shortDescription}
              </p>
            )}

            {/* CTA */}
            {showAddToCart && (
              <div className="flex flex-wrap gap-4">
                <Link
                  href={banner?.ctaLink || `/product/${displayProduct?.slug || banner?._id}`}
                  onClick={() => handleBannerClick(banner?._id)}
                  className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  Add to Cart
                </Link>

                {banner?.ctaText && banner.ctaText !== 'Add to Cart' && (
                  <Link
                    href={banner.ctaLink || '#'}
                    onClick={() => handleBannerClick(banner?._id)}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full border-2 border-gray-900 text-gray-900 font-semibold hover:bg-gray-900 hover:text-white transition-colors"
                  >
                    {banner.ctaText}
                  </Link>
                )}
              </div>
            )}

            {/* Features/Tags */}
            {banner?.tags && banner.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {banner.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </section>
    );
  }

  // Brand Layout - Brand Story
  if (layout === 'brand') {
    const brand = banner?.targetBrand;
    const imageUrl = banner?.image?.url;

    return (
      <section className="product-banner-brand py-8">
        <div 
          className="relative rounded-2xl overflow-hidden h-[350px] md:h-[450px]"
          style={{
            background: imageUrl
              ? undefined
              : `linear-gradient(135deg, ${banner?.backgroundColor || '#1A1A2E'} 0%, ${banner?.backgroundColor || '#1A1A2E'}dd 100%)`
          }}
        >
          {imageUrl && (
            <>
              <Image
                src={imageUrl}
                alt={banner?.title || brand?.name || 'Brand'}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900/90 via-gray-900/70 to-gray-900/40"></div>
            </>
          )}

          <div className="relative z-10 h-full container mx-auto px-6 md:px-10 flex items-center">
            <div className="max-w-lg">
              {/* Brand Logo */}
              {brand?.logo && (
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <Image
                    src={brand.logo.url}
                    alt={brand.name}
                    width={160}
                    height={80}
                    className="h-16 w-auto"
                  />
                </motion.div>
              )}

              {/* Title */}
              <motion.h3
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-white text-3xl md:text-4xl font-bold mb-4"
              >
                {banner?.title || brand?.name || 'Discover Our Brand'}
              </motion.h3>

              {/* Description */}
              {banner?.description || brand?.description && (
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-white/80 text-base mb-6"
                >
                  {banner?.description || brand?.description}
                </motion.p>
              )}

              {/* CTA */}
              {banner?.ctaText && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Link
                    href={banner.ctaLink || `/brand/${brand?.slug}`}
                    onClick={() => handleBannerClick(banner?._id)}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-white text-gray-900 font-semibold hover:bg-gray-100 transition-colors"
                  >
                    {banner.ctaText}
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Upsell Layout - Cart Upsell
  if (layout === 'upsell') {
    const displayProduct = product || banner?.targetProduct;

    return (
      <section className="product-banner-upsell py-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-xl overflow-hidden bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-4 md:p-6"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/30 rounded-full -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative flex flex-col md:flex-row items-center gap-4 md:gap-6">
            {/* Product Image */}
            <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden flex-shrink-0">
              {banner?.image?.url || displayProduct?.images?.[0]?.url ? (
                <Image
                  src={banner?.image?.url || displayProduct?.images?.[0]?.url || ''}
                  alt={banner?.title || displayProduct?.name || 'Product'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-amber-200"></div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 text-center md:text-left">
              <span className="inline-block px-2 py-1 rounded bg-amber-200 text-amber-800 text-xs font-semibold mb-2">
                Special Offer
              </span>
              <h4 className="text-gray-900 font-bold text-lg mb-1">
                {banner?.title || displayProduct?.name || 'Add to Your Order'}
              </h4>
              {displayProduct?.shortDescription && (
                <p className="text-gray-600 text-sm line-clamp-1">
                  {displayProduct.shortDescription}
                </p>
              )}
            </div>

            {/* Price & CTA */}
            <div className="flex flex-col md:flex-row items-center gap-3 flex-shrink-0">
              {showPrice && (
                <div className="text-center md:text-right">
                  <span className="text-gray-900 font-bold text-xl">
                    ₦{displayProduct?.price?.toLocaleString() || 0}
                  </span>
                  {displayProduct?.comparePrice && (
                    <span className="text-gray-400 line-through text-sm ml-2">
                      ₦{displayProduct.comparePrice.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              
              <Link
                href={banner?.ctaLink || `/product/${displayProduct?.slug}`}
                onClick={() => handleBannerClick(banner?._id)}
                className="inline-flex items-center justify-center gap-2 px-6 py-2 rounded-full bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
              >
                {banner?.ctaText || 'Add to Cart'}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </Link>
            </div>
          </div>
        </motion.div>
      </section>
    );
  }

  // Sidebar Layout
  if (layout === 'sidebar') {
    const displayProduct = product || banner?.targetProduct;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-xl overflow-hidden bg-white border border-gray-200 shadow-sm"
      >
        {/* Image */}
        {banner?.image?.url || displayProduct?.images?.[0]?.url ? (
          <div className="relative h-[180px]">
            <Image
              src={banner?.image?.url || displayProduct?.images?.[0]?.url || ''}
              alt={banner?.title || displayProduct?.name || 'Product'}
              fill
              className="object-cover"
            />
            {calculateDiscount(displayProduct?.price || 0, displayProduct?.comparePrice) > 0 && (
              <div className="absolute top-2 left-2 px-2 py-1 rounded bg-red-500 text-white text-xs font-bold">
                -{calculateDiscount(displayProduct?.price || 0, displayProduct?.comparePrice)}%
              </div>
            )}
          </div>
        ) : (
          <div className="h-[180px] bg-gray-100"></div>
        )}

        {/* Content */}
        <div className="p-4">
          {/* Brand */}
          {banner?.targetBrand?.name && (
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
              {banner.targetBrand.name}
            </p>
          )}

          {/* Title */}
          <h4 className="text-gray-900 font-bold text-sm mb-2 line-clamp-2">
            {banner?.title || displayProduct?.name}
          </h4>

          {/* Rating */}
          {showReviews && displayProduct?.rating && (
            <div className="flex items-center gap-1 mb-2">
              <div className="flex gap-0.5">
                {renderStars(displayProduct.rating)}
              </div>
              <span className="text-gray-500 text-xs">
                ({displayProduct.reviewCount || 0})
              </span>
            </div>
          )}

          {/* Price */}
          {showPrice && (
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-gray-900 font-bold">
                ₦{displayProduct?.price?.toLocaleString() || 0}
              </span>
              {displayProduct?.comparePrice && (
                <span className="text-gray-400 line-through text-xs">
                  ₦{displayProduct.comparePrice.toLocaleString()}
                </span>
              )}
            </div>
          )}

          {/* CTA */}
          <Link
            href={banner?.ctaLink || `/product/${displayProduct?.slug}`}
            onClick={() => handleBannerClick(banner?._id)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            {banner?.ctaText || 'View Product'}
          </Link>
        </div>
      </motion.div>
    );
  }

  return null;
};

export default ProductBanner;
