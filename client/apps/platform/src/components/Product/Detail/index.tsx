'use client';

import PurchaseControls from './PurchaseControls';
import ShoppingBenefits from './ShoppingBenefits';
import ProductDescriptionAudio from './ProductDescriptionAudio';
import SellerChoices from './SellerChoices';
import SizeChoices from './SizeChoices';
import { resolveVariantGallery } from './variant-gallery';
import type {VendorSize} from './detail-types';
import {purchaseLimits,clampPurchaseQuantity} from './purchase-quantity';
import { resolveSellerChoice } from '@/utils/representativeOffer';
import { resolveCatalogueHref } from '@/lib/catalogueLinks';
import { useOfferImpression } from '@/components/Merchandising/useOfferImpression';
import { purchasableOffers } from '@/components/Merchandising/offers';
import { GiftOffer, PremiumOffer, SizeUpgrade } from '@/components/Merchandising/ProductOffers';
import { gtagEvent } from '@/lib/gtag';
import { resolveOfferVolume } from '@/utils/offerVolume';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from '@/components/UI/OptimizedImage';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Thumbs, Zoom, Pagination } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/thumbs';
import 'swiper/css/zoom';
import 'swiper/css/pagination';

import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import { useCompare } from '@/context/CompareContext';
import { useModalCompareContext } from '@/context/ModalCompareContext';
import Rate from '@/components/Other/Rate';
import ProductSpecifications from './ProductSpecifications';
import ShareButton from './ShareButton';
import OrderWhatsAppButton from './OrderWhatsAppButton';
import ProductReviews from '@/components/Product/ProductReviews';
import RelatedProducts from './RelatedProducts';
import PackPricingCard from '@/components/Product/PackPricingCard';
import { ProductType } from '@/types/product.types';
import { pickDefaultSizeFrom, resolvePackPricing } from 'commerce-core';
import * as Icon from 'react-icons/pi';

/** snake_case type → readable label, e.g. "single_malt_scotch" → "Single Malt Scotch". */
function formatType(type?: string): string {
  if (!type) return '';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Keyword-rich product H1 (SEO "3 Kings" — King 2). Appends the beverage type
 * to the name when it isn't already present, so "Glenfiddich 40 Year Old"
 * becomes "Glenfiddich 40 Year Old Single Malt Scotch".
 */
function buildProductHeading(p: any): string {
  if (p?.seoH1) return p.seoH1;
  const name = p?.name || '';
  const typeLabel = formatType(p?.type);
  if (!typeLabel) return name;
  return new RegExp(`\\b${typeLabel}\\b`, 'i').test(name)
    ? name
    : `${name} ${typeLabel}`;
}

/**
 * Keyword-bearing opening sentence (SEO "3 Kings" — King 3). Falls back to a
 * purchase-intent sentence when the product has no shortDescription.
 */
function buildProductIntro(p: any): string {
  if (p?.shortDescription) return p.shortDescription;
  const name = p?.name || 'this drink';
  const brand = p?.brand?.name ? ` by ${p.brand.name}` : '';
  const typeLabel = formatType(p?.type);
  const type = typeLabel ? ` ${typeLabel}` : '';
  return `Buy ${name}${brand}${type} online in Nigeria — fast delivery across Lagos, Abuja & nationwide on DrinksHarbour.`;
}

interface ProductDetailProps {
  productData: any;
  relatedProducts?: ProductType[];
  purchaseBlocked?: boolean;
  marketplaceOffers?: boolean;
  preferredOffer?: { seller: string; size: string };
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

const ProductDetail: React.FC<ProductDetailProps> = ({ productData, relatedProducts = [], purchaseBlocked = false, marketplaceOffers = false, preferredOffer }) => {
  const router = useRouter();
  
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const [activeSize, setActiveSize] = useState<string>('');
  const explicitSeller = React.useRef(false);
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const [storedQuantity, setLocalQuantity] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<string>('description');
  const [showImageModal, setShowImageModal] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [toast, setToast] = useState<ToastState>({ show: false, message: '', type: 'success' });
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const { addToWishlist, removeFromWishlist, wishlistState } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const { addToCompare, removeFromCompare, isInCompare } = useCompare();
  const { openModalCompare } = useModalCompareContext();

  const productId = productData?._id || productData?.id || '';
  const isProductInCompare = isInCompare(productId);

  const vendors = useMemo(() => productData?.availableAt || [], [productData]);

  const linkedOffer = useMemo(() => marketplaceOffers && preferredOffer
    ? purchasableOffers(productData).find(offer => offer.seller._id === preferredOffer.seller && offer.size._id === preferredOffer.size)
    : undefined, [productData, preferredOffer, marketplaceOffers]);
  const selectedVendor = useMemo(() => resolveSellerChoice<(typeof vendors)[number]>(
    vendors, explicitSeller.current ? activeVendor : null, linkedOffer?.seller._id || productData.shoppingOffer?.subProductId,
  ), [vendors, activeVendor, linkedOffer, productData.shoppingOffer]);

  const vendorSizes: VendorSize[] = useMemo(() => {
    if (!selectedVendor) return [];
    return selectedVendor.sizes.map((s: any) => ({
      _id: s._id,
      size: s.size,
      displayName: s.displayName || s.size,
      colorName: s.colorName,
      optionName: s.optionName,
      image: s.image,
      imageScope: s.imageScope,
      stock: s.availableStock ?? s.stock,
      availableStock: s.availableStock,
      inStock: s.inStock,
      availability: s.availability,
      price: s.pricing?.websitePrice || 0,
      originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.websitePrice || 0,
      displayPrice: s.pricing?.displayPrice || `${s.pricing?.currencySymbol || '₦'}${s.pricing?.websitePrice || 0}`,
      currencySymbol: s.pricing?.currencySymbol || '₦',
      discount: s.discount,
      volumeMl: resolveOfferVolume(s),
      minOrderQuantity: s.minOrderQuantity || 1,
      maxOrderQuantity: s.maxOrderQuantity,
      packUnitPrice: s.pricing?.packUnitPrice ?? null,
      packThreshold: s.pricing?.packThreshold ?? null,
      packSavingsPct: s.pricing?.packSavingsPct ?? null,
      packPlatformCostPrice: s.pricing?.packPlatformCostPrice ?? null,
    }));
  }, [selectedVendor]);

  // The default variant is computed during render — NOT in a useEffect — so the
  // server-rendered HTML matches what the browser shows after hydration. When
  // this lived in an effect, SSR had no selected size and fell back to
  // priceRange.min (the cheapest variant, frequently out of stock), so crawlers
  // and Merchant Center read a different price/availability than real users saw.
  const defaultSize = useMemo(
    () => (vendorSizes.find(s => s._id === productData.shoppingOffer?.sizeId && purchaseLimits(s).canBuy) ?? pickDefaultSizeFrom(vendorSizes.filter(s => purchaseLimits(s).canBuy)))?._id ?? '',
    [vendorSizes, productData.shoppingOffer],
  );

  // A user's explicit pick wins; otherwise fall back to the default. Switching
  // vendors can strand activeSize on a size the new vendor doesn't carry, so
  // the lookup below falls back rather than rendering a null selection.
  const selectedSizeData = useMemo(() => {
    if (!vendorSizes.length) return null;
    return (
      vendorSizes.find((s) => s._id === activeSize) ??
      (!explicitSeller.current ? vendorSizes.find(s => s._id === linkedOffer?.size._id) : undefined) ??
      vendorSizes.find((s) => s._id === defaultSize) ??
      null
    );
  }, [activeSize, defaultSize, linkedOffer, vendorSizes]);

  const effectiveSize = selectedSizeData?.size ?? '';
  const images = resolveVariantGallery(
    selectedSizeData,
    vendorSizes,
    selectedVendor?.imagesOverride || [],
    productData?.images || []
  );
  const galleryKey = images.map(image => image.url).join('|');
  useEffect(() => {
    setActiveImageIndex(0);
  }, [galleryKey]);
  const limits = purchaseLimits(selectedSizeData);
  const localQuantity = clampPurchaseQuantity(storedQuantity, limits);

  const displayPrice = (() => {
    const basePrice = selectedSizeData?.price ?? productData?.priceRange?.min ?? 0;
    const origPrice = selectedSizeData?.originalPrice ?? basePrice;
    // If server already computed a discount, use base price as-is
    if (origPrice > basePrice && basePrice > 0) return basePrice;
    // Client-side fallback: compute from raw sale fields on the selected vendor
    const vendor = selectedVendor as any;
    if (vendor?.isOnSale && vendor?.saleDiscountValue > 0 && basePrice > 0) {
      const now = new Date();
      const saleStart = vendor.saleStartDate ? new Date(vendor.saleStartDate) : null;
      const saleEnd = vendor.saleEndDate ? new Date(vendor.saleEndDate) : null;
      const clientSaleActive = (!saleStart || now >= saleStart) && (!saleEnd || now <= saleEnd);
      if (clientSaleActive) {
        const saleType = vendor.saleType || 'percentage';
        const computed = saleType === 'fixed'
          ? Math.max(0, basePrice - vendor.saleDiscountValue)
          : parseFloat((basePrice * (1 - vendor.saleDiscountValue / 100)).toFixed(2));
        if (computed < basePrice) return computed;
      }
    }
    return basePrice;
  })();

  const displayOriginalPrice = (() => {
    const basePrice = selectedSizeData?.price ?? productData?.priceRange?.min ?? 0;
    const origPrice = selectedSizeData?.originalPrice ?? basePrice;
    if (origPrice > basePrice && basePrice > 0) return origPrice;
    // If client-side computed a lower price, original = base
    if (displayPrice < basePrice) return basePrice;
    return displayPrice;
  })();

  const selectedVolumeMl = resolveOfferVolume(selectedSizeData, productData.volumeMl);

  const showDetailDiscount = displayOriginalPrice > displayPrice && displayPrice > 0;
  const displayCurrencySymbol = selectedSizeData?.currencySymbol || productData?.priceRange?.currencySymbol || '₦';

  // ── Pack pricing (quantity-triggered) ──────────────────────────────────────
  // Rules (sale precedence, and hiding packs the stock can't fulfil) live in
  // commerce-core's pack-pricing module so the quickview modal and the cart agree with this page.
  const packPricing = resolvePackPricing({
    packUnitPrice: selectedSizeData?.packUnitPrice,
    packThreshold: selectedSizeData?.packThreshold,
    packSavingsPct: selectedSizeData?.packSavingsPct,
    unitPrice: displayPrice,
    quantity: localQuantity,
    stock: selectedSizeData?.stock,
    maxOrderQuantity: selectedSizeData?.maxOrderQuantity,
    onSale: showDetailDiscount,
  });
  const {
    hasPackPricing,
    packRateActive,
    effectiveUnitPrice,
    effectiveTotal,
    thresholdRemaining: packThresholdRemaining,
  } = packPricing;
  const packImpressionRef = useOfferImpression<HTMLDivElement>('pack_upgrade',
    marketplaceOffers && hasPackPricing && !purchaseBlocked ? selectedSizeData?._id : undefined);

  const discountPercentage = useMemo(() => {
    if (selectedSizeData?.discount?.percentage) {
      return selectedSizeData.discount.percentage;
    }
    if (showDetailDiscount && displayOriginalPrice > 0) {
      return Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100);
    }
    return 0;
  }, [selectedSizeData, displayOriginalPrice, displayPrice, showDetailDiscount]);

  const inStock = limits.canBuy;
  const isLowStock = (selectedSizeData?.stock ?? 0) > 0 && (selectedSizeData?.stock ?? 0) <= 5;
  const hasDiscount = showDetailDiscount;
  const isFixedDiscount = selectedSizeData?.discount?.type === 'fixed';

  useEffect(() => {
    if (productData?.availableAt?.length > 0 && !explicitSeller.current) {
      const offer = productData.availableAt.find((v: { _id?: string }) => String(v._id) === productData.shoppingOffer?.subProductId) || productData.availableAt[0];
      setActiveVendor(String(offer._id));
      if (productData.shoppingOffer) setActiveSize(offer.sizes.find((size: { _id?: string }) => String(size._id) === productData.shoppingOffer.sizeId)?._id || '');
    }
  }, [productData, activeVendor]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ ...toast, show: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    setLocalQuantity(previous => clampPurchaseQuantity(previous, purchaseLimits(selectedSizeData)));
  }, [selectedSizeData]);

  const handleQuantityChange = useCallback((change: number) => {
    if (purchaseBlocked) return;
    setLocalQuantity(previous => clampPurchaseQuantity(previous + change, purchaseLimits(selectedSizeData)));
  }, [selectedSizeData, purchaseBlocked]);

  const handleSetQuantityToPack = useCallback(() => {
    if (!packPricing.packThreshold || purchaseBlocked) return;
    const bounds = purchaseLimits(selectedSizeData);
    if (!bounds.canBuy || packPricing.packThreshold > bounds.max) return;
    setLocalQuantity(clampPurchaseQuantity(packPricing.packThreshold, bounds));
    if (marketplaceOffers) gtagEvent('merchandising_select', { source: 'pack_upgrade', offer_id: selectedSizeData?._id });
  }, [packPricing.packThreshold, selectedSizeData, purchaseBlocked, marketplaceOffers]);

  const handleAddToCart = useCallback(async (gift = false) => {
    if (!productData || !selectedSizeData || !selectedVendor) {
      setToast({ show: true, message: 'Please select a size and vendor', type: 'error' });
      return;
    }
    if (purchaseBlocked || !inStock || localQuantity < limits.min || localQuantity > limits.max) {
      setToast({ show: true, message: purchaseBlocked ? 'Please refresh seller availability before ordering.' : 'This quantity is unavailable. Choose another size or seller.', type: 'error' });
      return;
    }

    setIsAddingToCart(true);
    
    try {
      await addToCart(productData, effectiveSize, [selectedSizeData?.colorName, selectedSizeData?.optionName].filter(Boolean).join(' · '), selectedVendor.tenant.name, selectedVendor.tenant._id, localQuantity, selectedSizeData?._id, selectedVendor._id, selectedSizeData?.displayName || selectedSizeData?.optionName || undefined);
      if (gift) {
        gtagEvent('merchandising_select', { source: 'gift' });
        router.push('/cart?gift=1');
      } else {
        setToast({ show: true, message: 'Added to cart successfully!', type: 'success' });
      }
    } catch (error) {
      setToast({ show: true, message: 'Failed to add to cart', type: 'error' });
    } finally {
      setIsAddingToCart(false);
    }
  }, [productData, selectedSizeData, selectedVendor, effectiveSize, localQuantity, addToCart, inStock, purchaseBlocked, limits.min, limits.max, router]);

  const handleAddToWishlist = useCallback(() => {
    if (!productData) return;
    const isActive = wishlistState.wishlistArray.some((item: any) => item.id === productData._id);
    if (isActive) {
      removeFromWishlist(productData._id);
      setToast({ show: true, message: 'Removed from wishlist', type: 'success' });
    } else {
      addToWishlist(productData);
      setToast({ show: true, message: 'Added to wishlist!', type: 'success' });
    }
    openModalWishlist();
  }, [productData, wishlistState, removeFromWishlist, addToWishlist, openModalWishlist]);

  const handleAddToCompare = useCallback(() => {
    if (!productData) return;
    
    const isActive = isInCompare(productId);
    
    if (isActive) {
      removeFromCompare(productId);
      setToast({ show: true, message: 'Removed from compare', type: 'success' });
      openModalCompare();
    } else {
      const result = addToCompare(productData);
      if (result.success) {
        setToast({ show: true, message: 'Added to compare!', type: 'success' });
        openModalCompare();
      } else {
        setToast({ show: true, message: result.message, type: 'error' });
        openModalCompare();
      }
    }
  }, [productData, productId, isInCompare, removeFromCompare, addToCompare, openModalCompare]);

  const renderToast = () => {
    if (!toast.show) return null;
    return (
      <div className={`fixed bottom-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all transform translate-y-0 ${
        toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}>
        <div className="flex items-center gap-2">
          {toast.type === 'success' ? <Icon.PiCheckCircle size={20} /> : <Icon.PiWarningCircle size={20} />}
          <span>{toast.message}</span>
        </div>
      </div>
    );
  };

  if (!productData) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Icon.PiWarningCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Product not found</p>
        </div>
      </div>
    );
  }

  const hasMultipleImages = images.length > 1;

  // Safe canonical share URL — only when hostname matches (stripped www)
  // so tenant subdomains keep their own storefront context.
  const shareUrl = (() => {
    const canonical = productData?.canonicalUrl;
    if (!canonical) return undefined;
    try {
      const canonicalHost = new URL(canonical).hostname.replace(/^www\./, '');
      const currentHost = window.location.hostname.replace(/^www\./, '');
      return canonicalHost === currentHost ? canonical : undefined;
    } catch {
      return undefined;
    }
  })();

  return (
    <div className="product-detail bg-white">
      {renderToast()}
      
      {/* Main Product Section */}
      <section className="py-8 lg:py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            
            {/* Left: Image Gallery */}
            <div className="product-gallery">
              <div className="sticky top-24">
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-100 mb-4 group">
                  {images.length > 0 ? (
                    <Swiper
                      key={galleryKey}
                      modules={[Navigation, Thumbs, Zoom]}
                      thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
                      zoom={true}
                      navigation
                      onSlideChange={(swiper) => setActiveImageIndex(swiper.activeIndex)}
                      className="w-full h-full"
                    >
                      {images.map((img: any, index: number) => (
                        <SwiperSlide key={index}>
                          <div className="swiper-zoom-container w-full h-full">
                            <Image
                              src={img.url}
                              alt={img.alt || `${productData.name} ${index + 1}`}
                              fill
                              className="object-cover cursor-zoom-in"
                              sizes="(max-width: 1023px) calc(100vw - 32px), (max-width: 1535px) calc(50vw - 48px), 720px"
                              preload={index === 0}
                            />
                          </div>
                        </SwiperSlide>
                      ))}
                    </Swiper>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <Icon.PiImage size={64} className="text-gray-400" />
                    </div>
                  )}

                    {/* Badges */}
                  <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
                    {showDetailDiscount && (
                      <div className={`px-3 py-1.5 text-white text-sm font-bold rounded-full flex items-center gap-1 ${
                        selectedSizeData?.discount?.type === 'flash_sale'
                          ? 'bg-gradient-to-r from-orange-500 to-red-500 animate-pulse'
                          : isFixedDiscount
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                            : 'bg-red-500'
                      }`}>
                        {selectedSizeData?.discount?.type === 'flash_sale' && <Icon.PiLightningFill size={12} />}
                        {isFixedDiscount
                          ? `₦${(selectedSizeData?.discount?.value ?? (displayOriginalPrice - displayPrice)).toLocaleString()} OFF`
                          : `-${discountPercentage}% OFF`}
                      </div>
                    )}
                    {productData.badge && productData.badge.name && (
                      <div 
                        className="px-3 py-1.5 text-white text-sm font-bold rounded-full"
                        style={{ backgroundColor: productData.badge.color || '#10B981' }}
                      >
                        {productData.badge.name}
                      </div>
                    )}
                  </div>

                  {/* Zoom Button */}
                  <button
                    onClick={() => setShowImageModal(true)}
                    className="absolute bottom-4 right-4 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <Icon.PiMagnifyingGlassPlus size={20} />
                  </button>
                </div>

                {/* Thumbnail Gallery */}
                {hasMultipleImages && (
                  <Swiper
                    key={galleryKey}
                    onSwiper={setThumbsSwiper}
                    spaceBetween={10}
                    slidesPerView={4}
                    watchSlidesProgress
                    modules={[Thumbs]}
                    className="thumbs-swiper"
                  >
                    {images.map((img: any, index: number) => (
                      <SwiperSlide key={index}>
                        <div className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          activeImageIndex === index ? 'border-black' : 'border-transparent hover:border-gray-300'
                        }`}>
                          <Image
                            src={img.url}
                            alt={img.alt || `Thumbnail ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="100px"
                          />
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                )}
              </div>
            </div>

            {/* Right: Product Info */}
            <div className="product-info space-y-6">
              {/* Brand & Title */}
              <div>
                {productData.brand?.name &&
                  (productData.brand?.slug ? (
                    <Link
                      href={resolveCatalogueHref(`/brands/${productData.brand.slug}`)}
                      className="mb-2 inline-block text-sm font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-900 hover:underline"
                    >
                      {productData.brand.name}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      {productData.brand.name}
                    </p>
                  ))}
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                  {buildProductHeading(productData)}
                </h1>
              </div>

              {/* Rating & SKU */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Rate currentRate={productData.averageRating || 0} size={16} />
                  <span className="text-sm text-gray-600">
                    {productData.averageRating?.toFixed(1) || '0.0'} 
                    <span className="text-gray-400 ml-1">({productData.reviewCount || 0} reviews)</span>
                  </span>
                </div>
                {productData.sku && (
                  <span className="text-sm text-gray-400">| SKU: {productData.sku}</span>
                )}
              </div>

              {/* Price */}
              <div className="flex flex-wrap items-baseline gap-3 py-4 border-y border-gray-100">
                {packRateActive ? (
                  <>
                    <span className="text-4xl font-bold text-amber-600">
                      {displayCurrencySymbol}{effectiveUnitPrice.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-xl text-gray-400 line-through">
                      {displayCurrencySymbol}{displayPrice.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-sm font-bold rounded-full flex items-center gap-1">
                      <Icon.PiArchive size={12} />
                      Pack rate · Save {packPricing.packSavingsPct ?? 0}%
                    </span>
                  </>
                ) : showDetailDiscount ? (
                  <>
                    <span className="text-4xl font-bold text-red-600">
                      {displayCurrencySymbol}{displayPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </span>
                    <span className="text-xl text-gray-400 line-through">
                      {displayCurrencySymbol}{displayOriginalPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                      Save {displayCurrencySymbol}{(displayOriginalPrice - displayPrice).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </span>
                  </>
                ) : (
                  <span className="text-4xl font-bold text-gray-900">
                    {displayCurrencySymbol}{displayPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  </span>
                )}
                {hasPackPricing && !packRateActive && (
                  <span className="text-xs text-amber-500 font-medium ml-auto">
                    from {displayCurrencySymbol}{(packPricing.packUnitPrice as number).toLocaleString('en-NG', { maximumFractionDigits: 0 })}/unit at {packPricing.packThreshold}+
                  </span>
                )}
              </div>

              {/* Short Description — keyword-bearing lede (SEO "3 Kings" — King 3) */}
              <p className="text-gray-600 leading-relaxed">
                {buildProductIntro(productData)}
              </p>

              {marketplaceOffers && preferredOffer && !linkedOffer && !explicitSeller.current && (
                <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  The suggested seller or size is unavailable. Review the current options below.
                </p>
              )}
              <SellerChoices sellers={vendors} selectedId={selectedVendor?._id}
                nearestId={productData.shoppingOffer?.subProductId} locationOrder={!!productData.locationOrder}
                onSelect={id => { explicitSeller.current = true; setActiveVendor(id); setActiveSize(''); }} />
              <SizeChoices sizes={vendorSizes} selected={selectedSizeData?._id || ''} onSelect={setActiveSize} />

              {marketplaceOffers && selectedSizeData && !purchaseBlocked && inStock && (
                <SizeUpgrade selected={selectedSizeData} sizes={vendorSizes} unitPrice={displayPrice} onSelect={setActiveSize} />
              )}

              {/* Pack Pricing Card */}
              {hasPackPricing && (
                <div ref={packImpressionRef}>
                  <PackPricingCard
                    sizeLabel={selectedSizeData?.displayName || selectedSizeData?.size}
                    currencySymbol={displayCurrencySymbol}
                    packUnitPrice={packPricing.packUnitPrice as number}
                    packThreshold={packPricing.packThreshold as number}
                    packSavingsPct={packPricing.packSavingsPct}
                    normalPrice={displayPrice}
                    quantity={localQuantity}
                    packRateActive={packRateActive}
                    packThresholdRemaining={packThresholdRemaining}
                    onQuickAddPack={handleSetQuantityToPack}
                  />
                </div>
              )}

              <PurchaseControls quantity={localQuantity} limits={limits} blocked={purchaseBlocked}
                adding={isAddingToCart} size={selectedSizeData?.displayName} seller={selectedVendor?.tenant.name}
                currency={displayCurrencySymbol} total={effectiveTotal} onChange={handleQuantityChange} onAdd={() => void handleAddToCart()}>
                  <OrderWhatsAppButton
                    productName={productData.name || 'this product'}
                    size={selectedSizeData?.displayName || effectiveSize}
                    quantity={localQuantity}
                    unitPrice={effectiveUnitPrice}
                    total={effectiveTotal}
                    currencySymbol={displayCurrencySymbol}
                    seller={selectedVendor?.tenant.name}
                    packRateActive={packRateActive}
                    outOfStock={purchaseBlocked || !inStock}
                    productPath={productData.slug ? `/product/${encodeURIComponent(productData.slug)}` : undefined}
                    disabled={purchaseBlocked || !effectiveSize || !inStock}
                  />
              </PurchaseControls>

              {marketplaceOffers && selectedVendor && !purchaseBlocked && inStock && (
                <PremiumOffer product={productData} related={relatedProducts} sellerId={selectedVendor.tenant._id}
                  unitPrice={displayPrice} volume={selectedVolumeMl} />
              )}
              {marketplaceOffers && selectedVendor && inStock && /wine|champagne|spirit|whisk|cognac|gin|rum|tequila|vodka/i.test(productData.type ?? '') && (
                <GiftOffer disabled={purchaseBlocked || isAddingToCart} onGift={() => void handleAddToCart(true)} />
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToWishlist}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium transition-all ${
                    wishlistState.wishlistArray.some((item: any) => item.id === productData._id)
                      ? 'border-red-500 text-red-600 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  {wishlistState.wishlistArray.some((item: any) => item.id === productData._id) ? (
                    <Icon.PiHeartFill size={18} className="text-red-500" />
                  ) : (
                    <Icon.PiHeart size={18} />
                  )}
                  {wishlistState.wishlistArray.some((item: any) => item.id === productData._id) ? 'Saved' : 'Save'}
                </button>

                <button
                  onClick={handleAddToCompare}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium transition-all ${
                    isProductInCompare
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <Icon.PiScales size={18} />
                  {isProductInCompare ? 'In Compare' : 'Compare'}
                </button>

                <ShareButton
                  name={productData.name}
                  description={productData.shortDescription || productData.description}
                  url={shareUrl}
                />
              </div>

              <ShoppingBenefits />

              {/* Quick Info Cards */}
              <div className="grid grid-cols-3 gap-3">
                {productData.isAlcoholic && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Icon.PiWine size={18} className="text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700">18+ Required</span>
                  </div>
                )}
                {!!productData.abv && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <Icon.PiFlask size={18} className="text-gray-600" />
                    <span className="text-xs font-semibold text-gray-700">{productData.abv}% ABV</span>
                  </div>
                )}
                {!!selectedVolumeMl && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <Icon.PiDrop size={18} className="text-gray-600" />
                    <span className="text-xs font-semibold text-gray-700">{selectedVolumeMl}ml</span>
                  </div>
                )}
              </div>

              {/* Product Meta - Enhanced */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {productData.sku && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiBarcode size={14} /> SKU
                    </span>
                    <span className="font-mono text-gray-900">{productData.sku}</span>
                  </div>
                )}
                {productData.barcode && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiBarcode size={14} /> Barcode
                    </span>
                    <span className="font-mono text-gray-900">{productData.barcode}</span>
                  </div>
                )}
                {productData.category && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiTag size={14} /> Category
                    </span>
                    {productData.category?.slug ? (
                      <Link
                        href={`/shop?category=${encodeURIComponent(productData.category.slug)}`}
                        className="font-medium text-gray-900 transition-colors hover:underline"
                      >
                        {productData.category.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-900">{productData.category.name || productData.category}</span>
                    )}
                  </div>
                )}
                {productData.subCategory?.name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiTag size={14} /> Style
                    </span>
                    {productData.subCategory?.slug && productData.category?.slug ? (
                      <Link
                        href={`/shop?category=${encodeURIComponent(productData.category.slug)}&subcategory=${encodeURIComponent(productData.subCategory.slug)}`}
                        className="font-medium text-gray-900 transition-colors hover:underline"
                      >
                        {productData.subCategory.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-gray-900">{productData.subCategory.name}</span>
                    )}
                  </div>
                )}
                {productData.originCountry && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiGlobe size={14} /> Origin
                    </span>
                    <span className="font-medium text-gray-900">{productData.originCountry}</span>
                  </div>
                )}
                {productData.region && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiMapPin size={14} /> Region
                    </span>
                    <span className="font-medium text-gray-900">{productData.region}</span>
                  </div>
                )}
                {productData.producer && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiFactory size={14} /> Producer
                    </span>
                    <span className="font-medium text-gray-900">{productData.producer}</span>
                  </div>
                )}
                {!!productData.abv && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 flex items-center gap-2">
                      <Icon.PiFlask size={14} /> Alcohol
                    </span>
                    <span className="font-medium text-gray-900">{productData.abv}% ABV</span>
                  </div>
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Icon.PiPackage size={14} /> Status
                  </span>
                  <span className={`font-bold ${inStock ? 'text-green-600' : 'text-red-600'}`}>
                    {inStock ? '✓ In Stock' : '✗ Out of Stock'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Section */}
      <section className="py-12 bg-gray-50 border-t border-gray-200">
        <div className="container mx-auto px-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {[
              { id: 'description', label: 'Description', icon: Icon.PiFileText },
              { id: 'specifications', label: 'Specifications', icon: Icon.PiList },
              { id: 'reviews', label: 'Reviews', icon: Icon.PiChatCircle },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white shadow-lg'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content — reviews bring their own cards, so they skip the white panel */}
          <div
            className={
              activeTab === 'reviews'
                ? ''
                : 'bg-white rounded-2xl p-6 md:p-8 shadow-sm'
            }
          >
            {activeTab === 'description' && (
              <div className="max-w-4xl">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-2xl font-bold text-gray-900">Product Description</h2>
                  <ProductDescriptionAudio
                    description={productData.description}
                    shortDescription={productData.shortDescription}
                  />
                </div>
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: productData.description || productData.shortDescription || 'No description available.' 
                  }}
                  className="text-gray-600 leading-relaxed prose"
                />
              </div>
            )}
            {activeTab === 'specifications' && (
              <ProductSpecifications productData={{ ...productData, volumeMl: selectedVolumeMl }} />
            )}
            {activeTab === 'reviews' && (
              <ProductReviews productId={productData._id} />
            )}
          </div>
        </div>
      </section>

      {/* Related Products — RelatedProducts owns the whole section (heading,
          "View All", arrows and slider). Wrapping it in another section with a
          duplicate heading nested two <section>s, doubled the padding, and left
          a second, inert pair of arrows on the page. */}
      <RelatedProducts
        products={relatedProducts}
        viewAllHref={
          productData?.category?.slug
            ? `/shop?category=${encodeURIComponent(productData.category.slug)}`
            : '/shop'
        }
      />

      {/* Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors z-10"
          >
            <Icon.PiX size={24} className="text-white" />
          </button>
          <div className="w-full max-w-5xl aspect-square relative" onClick={(e) => e.stopPropagation()}>
            <Swiper
              modules={[Navigation, Pagination]}
              navigation
              pagination={{ clickable: true }}
              initialSlide={activeImageIndex}
              className="w-full h-full"
            >
              {images.map((img: any, index: number) => (
                <SwiperSlide key={index}>
                  <div className="relative w-full h-full">
                    <Image
                      src={img.url}
                      alt={img.alt || `${productData.name} ${index + 1}`}
                      fill
                      className="object-contain"
                      sizes="100vw"
                    />
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;
