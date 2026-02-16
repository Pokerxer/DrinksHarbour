'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
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
import ProductReviews from './ProductReviews';
import RelatedProducts from './RelatedProducts';
import * as Icon from 'react-icons/pi';

const VENDOR_PALETTE = [
  '#1a1a2e', '#16213e', '#0f3460', '#533483', '#e94560',
  '#2c3e50', '#6b2d5b', '#1b4332', '#b8860b', '#3d405b',
];

function vendorPaletteIndex(name: string): number {
  return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % VENDOR_PALETTE.length;
}

function getInitials(name: string): string {
  const skip = new Set(['the', 'a', 'an']);
  const words = name
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !skip.has(w.toLowerCase()));
  if (!words.length) return name.charAt(0).toUpperCase();
  return words.slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('');
}

interface ProductDetailProps {
  productData: any;
  relatedProducts?: ProductType[];
}

interface VendorSize {
  _id: string;
  size: string;
  displayName: string;
  stock: number;
  availability: string;
  price: number;
  originalPrice: number;
  displayPrice: string;
  currencySymbol: string;
  discount?: { label?: string; percentage?: number } | null;
  volumeMl?: number;
  minOrderQuantity: number;
  maxOrderQuantity?: number;
}

interface ToastState {
  show: boolean;
  message: string;
  type: 'success' | 'error';
}

const ProductDetail: React.FC<ProductDetailProps> = ({ productData, relatedProducts = [] }) => {
  const router = useRouter();
  
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);
  const [activeSize, setActiveSize] = useState<string>('');
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const [localQuantity, setLocalQuantity] = useState<number>(1);
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

  const vendors = useMemo(() => productData?.availableAt || [], [productData]);

  const selectedVendor = useMemo(() => {
    if (!vendors.length) return null;
    if (activeVendor) {
      return vendors.find((v: any) => v.tenant._id === activeVendor) ?? vendors[0];
    }
    return vendors[0];
  }, [vendors, activeVendor]);

  const vendorSizes: VendorSize[] = useMemo(() => {
    if (!selectedVendor) return [];
    return selectedVendor.sizes.map((s: any) => ({
      _id: s._id,
      size: s.size,
      displayName: s.displayName || s.size,
      stock: s.stock,
      availability: s.availability,
      price: s.pricing?.websitePrice || 0,
      originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.websitePrice || 0,
      displayPrice: s.pricing?.displayPrice || `${s.pricing?.currencySymbol || '₦'}${s.pricing?.websitePrice || 0}`,
      currencySymbol: s.pricing?.currencySymbol || '₦',
      discount: s.discount,
      volumeMl: s.volumeMl,
      minOrderQuantity: s.minOrderQuantity || 1,
      maxOrderQuantity: s.maxOrderQuantity,
    }));
  }, [selectedVendor]);

  const selectedSizeData = useMemo(() => {
    if (!activeSize || !vendorSizes.length) return null;
    return vendorSizes.find((s) => s.size === activeSize) || null;
  }, [activeSize, vendorSizes]);

  const displayPrice = selectedSizeData?.price || productData?.priceRange?.min || productData?.price || 0;
  const displayOriginalPrice = selectedSizeData?.originalPrice || productData?.priceRange?.max || displayPrice;
  const displayCurrencySymbol = selectedSizeData?.currencySymbol || productData?.currencySymbol || '₦';
  
  const discountPercentage = useMemo(() => {
    if (selectedSizeData?.discount?.percentage) {
      return selectedSizeData.discount.percentage;
    }
    if (displayOriginalPrice > displayPrice && displayOriginalPrice > 0) {
      return Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100);
    }
    return 0;
  }, [selectedSizeData, displayOriginalPrice, displayPrice]);

  const inStock = (selectedSizeData?.stock || 0) > 0;
  const isLowStock = selectedSizeData?.stock && selectedSizeData.stock <= 5 && selectedSizeData.stock > 0;
  const hasDiscount = selectedVendor?.isOnSale || discountPercentage > 0;

  useEffect(() => {
    if (productData?.availableAt?.length > 0 && !activeVendor) {
      setActiveVendor(productData.availableAt[0].tenant._id);
    }
  }, [productData, activeVendor]);

  useEffect(() => {
    if (vendorSizes.length > 0) {
      const firstAvailable = vendorSizes.find((s) => s.stock > 0);
      setActiveSize(firstAvailable?.size || vendorSizes[0].size);
    }
  }, [vendorSizes]);

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => setToast({ ...toast, show: false }), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleQuantityChange = useCallback((change: number) => {
    if (!selectedSizeData) return;
    const newQty = localQuantity + change;
    const minQty = selectedSizeData.minOrderQuantity || 1;
    const maxQty = selectedSizeData.maxOrderQuantity || selectedSizeData.stock || 99;
    if (newQty >= minQty && newQty <= maxQty) {
      setLocalQuantity(newQty);
    }
  }, [localQuantity, selectedSizeData]);

  const handleAddToCart = useCallback(async () => {
    if (!productData || !selectedSizeData || !selectedVendor) {
      setToast({ show: true, message: 'Please select a size and vendor', type: 'error' });
      return;
    }
    if (!inStock) {
      setToast({ show: true, message: 'This size is out of stock', type: 'error' });
      return;
    }

    setIsAddingToCart(true);
    
    try {
      await addToCart(productData, activeSize, '', selectedVendor.tenant.name, selectedVendor.tenant._id, localQuantity, selectedSizeData?._id, selectedVendor._id);
      setToast({ show: true, message: 'Added to cart successfully!', type: 'success' });
      setTimeout(() => openModalCart(), 500);
    } catch (error) {
      setToast({ show: true, message: 'Failed to add to cart', type: 'error' });
    } finally {
      setIsAddingToCart(false);
    }
  }, [productData, selectedSizeData, selectedVendor, activeSize, localQuantity, addToCart, openModalCart, inStock]);

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
    
    const productId = productData._id;
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
  }, [productData, isInCompare, removeFromCompare, addToCompare, openModalCompare]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: productData?.name,
          text: productData?.shortDescription || productData?.description,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setToast({ show: true, message: 'Link copied to clipboard!', type: 'success' });
    }
  }, [productData]);

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

  const images = productData?.images || [];
  const hasMultipleImages = images.length > 1;

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
                              sizes="(max-width: 768px) 100vw, 50vw"
                              priority={index === 0}
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
                    {discountPercentage > 0 && (
                      <div className="px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-full">
                        -{discountPercentage}% OFF
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
                {productData.brand?.name && (
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {productData.brand.name}
                  </p>
                )}
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
                  {productData.name}
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
              <div className="flex items-baseline gap-3 py-4 border-y border-gray-100">
                <span className="text-4xl font-bold text-gray-900">
                  {displayCurrencySymbol}{displayPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                </span>
                {hasDiscount && displayOriginalPrice > displayPrice && (
                  <>
                    <span className="text-xl text-gray-400 line-through">
                      {displayCurrencySymbol}{displayOriginalPrice.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                      Save {displayCurrencySymbol}{(displayOriginalPrice - displayPrice).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    </span>
                  </>
                )}
              </div>

              {/* Short Description */}
              {productData.shortDescription && (
                <p className="text-gray-600 leading-relaxed">
                  {productData.shortDescription}
                </p>
              )}

              {/* Vendor Selection */}
              {vendors.length > 1 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Icon.PiStorefront size={18} />
                    Select Seller
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {vendors.map((vendor: any) => {
                      const isActive = selectedVendor?.tenant._id === vendor.tenant._id;
                      const bg = VENDOR_PALETTE[vendorPaletteIndex(vendor.tenant.name)];
                      return (
                        <button
                          key={vendor.tenant._id}
                          onClick={() => setActiveVendor(vendor.tenant._id)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                            isActive
                              ? 'border-black bg-white shadow-md'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: bg }}
                          >
                            {vendor.tenant.logo?.url ? (
                              <Image src={vendor.tenant.logo.url} alt="" width={32} height={32} className="rounded-full" />
                            ) : (
                              getInitials(vendor.tenant.name)
                            )}
                          </div>
                          <div className="text-left">
                            <div className="text-sm font-medium text-gray-900">{vendor.tenant.name}</div>
                            <div className="text-xs text-gray-500">{vendor.tenant.city}, {vendor.tenant.country}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Selection */}
              {vendorSizes.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Icon.PiRuler size={18} />
                      Select Size
                    </h3>
                    {isLowStock && (
                      <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                        <Icon.PiWarning size={14} />
                        Only {selectedSizeData?.stock} left!
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {vendorSizes.map((size: VendorSize) => {
                      const isSelected = activeSize === size.size;
                      const isOutOfStock = size.stock === 0;
                      
                      return (
                        <button
                          key={size._id || size.size}
                          onClick={() => !isOutOfStock && setActiveSize(size.size)}
                          disabled={isOutOfStock}
                          className={`relative p-3 rounded-xl border-2 text-left transition-all ${
                            isSelected
                              ? 'border-black bg-gray-900 text-white shadow-lg'
                              : isOutOfStock
                                ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed line-through opacity-60'
                                : 'border-gray-200 hover:border-gray-400 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-bold text-sm">{size.displayName}</div>
                              {size.volumeMl && (
                                <div className={`text-xs ${isSelected ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {size.volumeMl}ml
                                </div>
                              )}
                            </div>
                            <div className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                              {size.currencySymbol}{size.price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            </div>
                          </div>
                          {size.discount && !isOutOfStock && (
                            <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                              {size.discount.label || `-${size.discount.percentage}%`}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quantity & Add to Cart */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center border-2 border-gray-200 rounded-xl p-1 w-fit">
                  <button
                    onClick={() => handleQuantityChange(-1)}
                    disabled={localQuantity <= (selectedSizeData?.minOrderQuantity || 1)}
                    className="w-12 h-12 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    <Icon.PiMinus size={18} />
                  </button>
                  <span className="w-16 text-center font-bold text-lg">{localQuantity}</span>
                  <button
                    onClick={() => handleQuantityChange(1)}
                    disabled={selectedSizeData?.maxOrderQuantity ? localQuantity >= selectedSizeData.maxOrderQuantity : false}
                    className="w-12 h-12 flex items-center justify-center rounded-lg bg-white hover:bg-gray-100 disabled:opacity-40 transition-colors"
                  >
                    <Icon.PiPlus size={18} />
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={!inStock || !activeSize || isAddingToCart}
                  className={`flex-1 py-4 px-8 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                    !activeSize
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : !inStock
                        ? 'bg-red-100 text-red-600 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-black shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isAddingToCart ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Adding...
                    </>
                  ) : !activeSize ? (
                    <>
                      <Icon.PiWarningCircle size={20} />
                      Select a Size
                    </>
                  ) : !inStock ? (
                    <>
                      <Icon.PiProhibit size={20} />
                      Out of Stock
                    </>
                  ) : (
                    <>
                      <Icon.PiShoppingCart size={20} />
                      Add to Cart
                      <span className="text-sm font-normal opacity-80">
                        ({displayCurrencySymbol}{(displayPrice * localQuantity).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')})
                      </span>
                    </>
                  )}
                </button>
              </div>

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
                    isInCompare(productData._id)
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <Icon.PiScales size={18} />
                  {isInCompare(productData._id) ? 'In Compare' : 'Compare'}
                </button>

                <button
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-medium transition-all"
                >
                  <Icon.PiShareNetwork size={18} />
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-2 gap-4 py-6 border-t border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Icon.PiTruck size={20} className="text-green-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Free Delivery</div>
                    <div className="text-xs text-gray-500">Orders over ₦10,000</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Icon.PiShieldCheck size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Secure Payment</div>
                    <div className="text-xs text-gray-500">100% Protected</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Icon.PiArrowUUpLeft size={20} className="text-orange-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Easy Returns</div>
                    <div className="text-xs text-gray-500">30 Day Policy</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Icon.PiCertificate size={20} className="text-purple-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">Authentic</div>
                    <div className="text-xs text-gray-500">Guaranteed</div>
                  </div>
                </div>
              </div>

              {/* Product Meta */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                {productData.abv && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Alcohol Content</span>
                    <span className="font-medium text-gray-900">{productData.abv}% ABV</span>
                  </div>
                )}
                {productData.originCountry && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Origin</span>
                    <span className="font-medium text-gray-900">{productData.originCountry}</span>
                  </div>
                )}
                {productData.type && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Category</span>
                    <span className="font-medium text-gray-900 capitalize">{productData.type.replace(/_/g, ' ')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Availability</span>
                  <span className={`font-medium ${inStock ? 'text-green-600' : 'text-red-600'}`}>
                    {inStock ? 'In Stock' : 'Out of Stock'}
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
              { id: 'description', label: 'Description', icon: PiFileText },
              { id: 'specifications', label: 'Specifications', icon: PiList },
              { id: 'reviews', label: 'Reviews', icon: PiChatCircle },
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

          {/* Tab Content */}
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm">
            {activeTab === 'description' && (
              <div className="max-w-4xl">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Description</h2>
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: productData.description || productData.shortDescription || 'No description available.' 
                  }}
                  className="text-gray-600 leading-relaxed prose"
                />
              </div>
            )}
            {activeTab === 'specifications' && (
              <ProductSpecifications productData={productData} />
            )}
            {activeTab === 'reviews' && (
              <ProductReviews
                reviews={productData?.reviews || []}
                averageRating={productData?.averageRating || 0}
                totalReviews={productData?.reviewCount || 0}
                productName={productData?.name}
              />
            )}
          </div>
        </div>
      </section>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">You May Also Like</h2>
              <a href="/shop" className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1">
                View All <Icon.PiArrowRight size={16} />
              </a>
            </div>
            <RelatedProducts products={relatedProducts} title="" />
          </div>
        </section>
      )}

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

// Import the icons we need
import { PiFileText, PiList, PiChatCircle } from 'react-icons/pi';

export default ProductDetail;
