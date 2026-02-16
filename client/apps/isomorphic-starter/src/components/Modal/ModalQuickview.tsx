'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import { useCompare } from '@/context/CompareContext';
import { useModalCompareContext } from '@/context/ModalCompareContext';
import Rate from '../Other/Rate';
import Link from 'next/link';
import { getInitials, VENDOR_PALETTE, vendorPaletteIndex } from '@/data/vendor-helpers';

// Types
interface VendorSize {
  _id: string;
  size: string;
  displayName: string;
  stock: number;
  availability: string;
  price: number;
  originalPrice?: number;
  displayPrice: string;
  currencySymbol: string;
  discount?: { label?: string; percentage?: number } | null;
  volumeMl?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
}

interface Vendor {
  tenant: {
    _id: string;
    name: string;
    city?: string;
    logo?: { url: string };
  };
  sizes: any[];
}

const ModalQuickview: React.FC = () => {
  const { selectedProduct, isOpen, closeQuickview } = useModalQuickviewContext();
  const [activeImage, setActiveImage] = useState(0);
  const [activeSize, setActiveSize] = useState<string>('');
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showAddedAnimation, setShowAddedAnimation] = useState(false);
  
  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const { addToWishlist, removeFromWishlist, wishlistState } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const { addToCompare, removeFromCompare, isInCompare, maxCompareLimit } = useCompare();
  const { openModalCompare } = useModalCompareContext();

  // Memoized values
  const isWishlistActive = useMemo(() => 
    selectedProduct && wishlistState.wishlistArray.some(item => item.id === selectedProduct.id),
    [selectedProduct, wishlistState.wishlistArray]
  );
  
  const isCompareActive = useMemo(() => 
    selectedProduct && isInCompare(selectedProduct.id),
    [selectedProduct, isInCompare]
  );

  const vendors = useMemo(() => selectedProduct?.availableAt || [], [selectedProduct]);

  const selectedVendor = useMemo(() => {
    if (!vendors.length) return null;
    if (activeVendor) {
      return vendors.find((v: Vendor) => v.tenant._id === activeVendor) ?? vendors[0];
    }
    return vendors[0];
  }, [vendors, activeVendor]);

  const vendorSizes: VendorSize[] = useMemo(() => {
    if (!selectedVendor) return [];
    return selectedVendor.sizes.map(s => ({
      _id: s._id,
      size: s.size,
      displayName: s.displayName || s.size,
      stock: s.stock,
      availability: s.availability,
      price: s.pricing.websitePrice,
      originalPrice: s.pricing.originalWebsitePrice || s.pricing.websitePrice,
      displayPrice: s.pricing.displayPrice,
      currencySymbol: s.pricing.currencySymbol,
      discount: s.discount,
      volumeMl: s.volumeMl,
      minOrderQuantity: s.minOrderQuantity || 1,
      maxOrderQuantity: s.maxOrderQuantity,
    }));
  }, [selectedVendor]);

  const selectedSizeData = useMemo(() => {
    if (!activeSize || !vendorSizes.length) return null;
    return vendorSizes.find(s => s.size === activeSize) || null;
  }, [activeSize, vendorSizes]);

  // Effects
  useEffect(() => {
    if (selectedProduct && vendors.length > 0 && !activeVendor) {
      setActiveVendor(vendors[0].tenant._id);
    }
  }, [selectedProduct, vendors, activeVendor]);

  useEffect(() => {
    if (vendorSizes.length > 0) {
      const firstAvailableSize = vendorSizes.find(s => s.stock > 0);
      setActiveSize(firstAvailableSize?.size || vendorSizes[0].size);
    }
  }, [vendorSizes]);

  useEffect(() => {
    if (!isOpen) {
      setActiveImage(0);
      setActiveSize('');
      setActiveVendor(null);
      setQuantity(1);
      setIsAddingToCart(false);
      setShowAddedAnimation(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeQuickview();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, closeQuickview]);

  // Handlers
  const handleAddToCart = useCallback(async () => {
    if (!selectedProduct || !selectedSizeData || !selectedVendor) {
      console.log('Quickview: Missing data', { selectedProduct: !!selectedProduct, selectedSizeData: !!selectedSizeData, selectedVendor: !!selectedVendor });
      return;
    }
    if (selectedSizeData.stock === 0) {
      return;
    }

    // Get vendor name with fallback
    const vendorName = selectedVendor.tenant?.name || selectedVendor.tenant?.slug || 'Unknown Vendor';
    const vendorId = selectedVendor.tenant?._id;
    const sizeId = selectedSizeData?._id;
    const subProductId = selectedVendor._id;

    console.log('Quickview: Adding to cart', {
      vendorName,
      vendorId,
      sizeId,
      subProductId,
      fullVendor: selectedVendor
    });

    setIsAddingToCart(true);
    
    try {
      await addToCart(selectedProduct, activeSize, '', vendorName, vendorId, quantity, sizeId, subProductId);
      
      setShowAddedAnimation(true);
      setTimeout(() => {
        setShowAddedAnimation(false);
        openModalCart();
        closeQuickview();
      }, 800);
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setIsAddingToCart(false);
    }
  }, [selectedProduct, selectedSizeData, selectedVendor, activeSize, quantity, addToCart, openModalCart, closeQuickview]);

  const handleAddToWishlist = useCallback(() => {
    if (!selectedProduct) return;
    if (isWishlistActive) {
      removeFromWishlist(selectedProduct.id);
    } else {
      addToWishlist(selectedProduct);
    }
    openModalWishlist();
  }, [selectedProduct, isWishlistActive, removeFromWishlist, addToWishlist, openModalWishlist]);

  const handleAddToCompare = useCallback(() => {
    if (!selectedProduct) return;
    
    if (isCompareActive) {
      removeFromCompare(selectedProduct.id);
      openModalCompare();
    } else {
      const result = addToCompare(selectedProduct);
      if (!result.success) {
        alert(result.message);
      }
      openModalCompare();
    }
  }, [selectedProduct, isCompareActive, removeFromCompare, addToCompare, openModalCompare]);

  const handleQuantityChange = useCallback((change: number) => {
    if (!selectedSizeData) return;
    const newQuantity = quantity + change;
    const minQty = selectedSizeData.minOrderQuantity || 1;
    const maxQty = selectedSizeData.maxOrderQuantity || selectedSizeData.stock || 10;
    if (newQuantity >= minQty && newQuantity <= maxQty) {
      setQuantity(newQuantity);
    }
  }, [quantity, selectedSizeData]);

  // Computed display values
  const displayPrice = selectedSizeData?.price || selectedProduct?.priceRange?.min || 0;
  const displayOriginalPrice = selectedSizeData?.originalPrice || selectedProduct?.priceRange?.max || 0;
  const displayCurrencySymbol = selectedSizeData?.currencySymbol || '₦';
  const discountPercentage = useMemo(() => {
    if (selectedSizeData?.discount?.percentage) {
      return selectedSizeData.discount.percentage;
    }
    if (displayOriginalPrice > displayPrice && displayOriginalPrice > 0) {
      return Math.floor(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100);
    }
    return 0;
  }, [selectedSizeData, displayOriginalPrice, displayPrice]);
  const inStock = (selectedSizeData?.stock || 0) > 0;

  if (!selectedProduct) return null;

  const images = selectedProduct?.images || [];
  const mainImage = images[activeImage]?.url || selectedProduct?.primaryImage?.url || selectedProduct?.thumbImage?.[0];

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      onClick={closeQuickview}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" />

      {/* Modal Content */}
      <div 
        className={`relative bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden transition-all duration-500 ${
          isOpen ? 'scale-100 translate-y-0 opacity-100' : 'scale-95 translate-y-8 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Success Animation Overlay */}
        {showAddedAnimation && (
          <div className="absolute inset-0 z-50 bg-green-500/90 flex flex-col items-center justify-center animate-fadeIn">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 animate-bounce">
              <Icon.PiCheck size={40} className="text-green-500" />
            </div>
            <p className="text-white text-xl font-bold">Added to Cart!</p>
          </div>
        )}

        {/* Close Button */}
        <button 
          className="absolute top-4 right-4 z-40 w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors shadow-lg"
          onClick={closeQuickview}
          aria-label="Close quick view"
        >
          <Icon.PiX size={20} />
        </button>

        <div className="flex flex-col lg:flex-row h-full max-h-[90vh]">
          {/* LEFT: Images */}
          <div className="lg:w-[45%] bg-gray-50 p-6 flex flex-col">
            {/* Main Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-white shadow-sm flex-1 group">
              {mainImage ? (
                <Image 
                  src={mainImage} 
                  alt={selectedProduct.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                  sizes="(max-width: 768px) 100vw, 45vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                  <Icon.PiImage size={64} />
                </div>
              )}

              {/* Discount Badge */}
              {discountPercentage > 0 && (
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-red-500 text-white text-sm font-bold rounded-full shadow-lg">
                  -{discountPercentage}%
                </div>
              )}

              {/* Out of Stock Badge */}
              {!inStock && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="px-4 py-2 bg-white text-gray-900 font-bold rounded-full">
                    Out of Stock
                  </span>
                </div>
              )}

              {/* Image Navigation Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage(prev => prev === 0 ? images.length - 1 : prev - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-lg"
                  >
                    <Icon.PiCaretLeft size={20} />
                  </button>
                  <button
                    onClick={() => setActiveImage(prev => prev === images.length - 1 ? 0 : prev + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-lg"
                  >
                    <Icon.PiCaretRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img: any, index: number) => (
                  <button 
                    key={index}
                    onClick={() => setActiveImage(index)}
                    className={`relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                      activeImage === index 
                        ? 'border-orange-500 shadow-md' 
                        : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <Image 
                      src={img.url}
                      alt={img.alt || `${selectedProduct.name} ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product Info */}
          <div className="lg:w-[55%] p-6 lg:p-8 overflow-y-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-3 text-sm">
              {selectedProduct.category && (
                <>
                  <Link 
                    href={`/shop/${selectedProduct.category.slug}`}
                    className="text-orange-600 hover:text-orange-700 font-medium"
                    onClick={closeQuickview}
                  >
                    {selectedProduct.category.name}
                  </Link>
                  {selectedProduct.subCategory && (
                    <>
                      <Icon.PiCaretRight size={14} className="text-gray-400" />
                      <span className="text-gray-600">{selectedProduct.subCategory.name}</span>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Brand & Title */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                {selectedProduct.brand && (
                  <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {selectedProduct.brand.name}
                  </p>
                )}
                <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-tight">
                  {selectedProduct.name}
                </h1>
              </div>
              <button 
                onClick={handleAddToWishlist}
                className={`w-12 h-12 flex items-center justify-center rounded-full border-2 transition-all flex-shrink-0 ${
                  isWishlistActive 
                    ? 'border-red-500 bg-red-50 text-red-500' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {isWishlistActive ? <Icon.PiHeartFill size={22} /> : <Icon.PiHeart size={22} />}
              </button>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-3 mb-4">
              <Rate currentRate={selectedProduct.averageRating || 0} size={16} />
              <span className="text-sm text-gray-600">
                <span className="font-semibold">{selectedProduct.averageRating?.toFixed(1) || '0.0'}</span>
                <span className="text-gray-400 ml-1">({selectedProduct.reviewCount || 0} reviews)</span>
              </span>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3 mb-4 pb-4 border-b border-gray-100">
              <span className="text-3xl font-bold text-gray-900">
                {displayCurrencySymbol}{displayPrice.toFixed(2)}
              </span>
              {displayOriginalPrice > displayPrice && (
                <span className="text-xl text-gray-400 line-through">
                  {displayCurrencySymbol}{displayOriginalPrice.toFixed(2)}
                </span>
              )}
              {discountPercentage > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-bold rounded-full">
                  Save {discountPercentage}%
                </span>
              )}
            </div>

            {/* Short Description */}
            {selectedProduct.shortDescription && (
              <p className="text-gray-600 mb-5 leading-relaxed text-sm">
                {selectedProduct.shortDescription}
              </p>
            )}

            {/* Vendor Selection */}
            {vendors.length > 1 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Icon.PiStorefront size={18} />
                  Select Seller
                  {selectedVendor && (
                    <span className="text-gray-500 font-normal">- {selectedVendor.tenant.name}</span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {vendors.map((vendor: Vendor) => {
                    const isActive = selectedVendor?.tenant._id === vendor.tenant._id;
                    const bg = VENDOR_PALETTE[vendorPaletteIndex(vendor.tenant.name)];
                    return (
                      <button
                        key={vendor.tenant._id}
                        onClick={() => setActiveVendor(vendor.tenant._id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                          isActive
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: bg }}
                        >
                          {vendor.tenant.logo?.url ? (
                            <Image src={vendor.tenant.logo.url} alt="" width={24} height={24} className="rounded-full" />
                          ) : (
                            getInitials(vendor.tenant.name)
                          )}
                        </div>
                        {vendor.tenant.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Size Selection */}
            {vendorSizes.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon.PiRuler size={18} />
                    Select Size
                  </span>
                  {selectedSizeData && (
                    <span className="text-gray-500 font-normal text-xs">
                      {selectedSizeData.stock > 10 ? '✓ In Stock' : selectedSizeData.stock > 0 ? `⚠ Only ${selectedSizeData.stock} left` : '✗ Out of Stock'}
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {vendorSizes.map((size: VendorSize) => {
                    const isSelected = activeSize === size.size;
                    const isOutOfStock = size.stock === 0;
                    const hasDiscount = size.originalPrice && size.originalPrice > size.price;
                    
                    return (
                      <button
                        key={size.size}
                        onClick={() => !isOutOfStock && setActiveSize(size.size)}
                        disabled={isOutOfStock}
                        className={`relative px-4 py-3 rounded-xl border-2 transition-all min-w-[80px] ${
                          isSelected
                            ? 'border-orange-500 bg-orange-500 text-white shadow-lg'
                            : isOutOfStock
                              ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                              : 'border-gray-200 bg-white text-gray-900 hover:border-orange-300'
                        }`}
                      >
                        <div className="text-sm font-bold">{size.displayName}</div>
                        {size.volumeMl && (
                          <div className={`text-xs ${isSelected ? 'text-orange-100' : 'text-gray-500'}`}>
                            {size.volumeMl}ml
                          </div>
                        )}
                        <div className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                          {size.currencySymbol}{size.price.toFixed(2)}
                        </div>
                        {hasDiscount && !isOutOfStock && (
                          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            -{Math.round(((size.originalPrice! - size.price) / size.originalPrice!) * 100)}%
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <Icon.PiCheck size={10} className="text-orange-500" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity & Add to Cart */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              {/* Quantity Selector */}
              <div className="flex items-center bg-gray-50 rounded-xl border-2 border-gray-200 p-1 w-fit">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= (selectedSizeData?.minOrderQuantity || 1)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <Icon.PiMinus size={16} />
                </button>
                <span className="w-14 text-center font-bold text-lg">{quantity}</span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  disabled={selectedSizeData?.maxOrderQuantity ? quantity >= selectedSizeData.maxOrderQuantity : false}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-gray-100 disabled:opacity-40 transition-colors"
                >
                  <Icon.PiPlus size={16} />
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={handleAddToCart}
                disabled={!inStock || !activeSize || isAddingToCart}
                className={`flex-1 py-3.5 px-6 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 ${
                  !activeSize
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : !inStock
                      ? 'bg-red-100 text-red-600 cursor-not-allowed'
                      : 'bg-gray-900 text-white hover:bg-gray-800 shadow-lg hover:shadow-xl'
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
                    <span className="ml-1">
                      ({displayCurrencySymbol}{(displayPrice * quantity).toFixed(2)})
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-5 border-t border-gray-100">
              <button
                onClick={handleAddToCompare}
                disabled={!isCompareActive && compareState.compareArray.length >= maxCompareLimit}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  isCompareActive
                    ? 'border-orange-500 text-orange-600 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50'
                } ${!isCompareActive && compareState.compareArray.length >= maxCompareLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isCompareActive ? <Icon.PiCheck size={18} /> : <Icon.PiArrowsCounterClockwise size={18} />}
                {isCompareActive ? 'In Compare List' : 'Compare'}
              </button>

              <Link
                href={`/product/${selectedProduct.slug}`}
                className="flex-1 py-3 px-4 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                onClick={closeQuickview}
              >
                <span>View Full Details</span>
                <Icon.PiArrowRight size={18} />
              </Link>
            </div>

            {/* Product Meta */}
            <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 gap-3 text-sm">
              {selectedProduct.sku && (
                <div className="flex justify-between">
                  <span className="text-gray-500">SKU:</span>
                  <span className="text-gray-900 font-medium">{selectedProduct.sku}</span>
                </div>
              )}
              {selectedProduct.abv && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Alcohol:</span>
                  <span className="text-gray-900 font-medium">{selectedProduct.abv}% ABV</span>
                </div>
              )}
              {selectedProduct.originCountry && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Origin:</span>
                  <span className="text-gray-900 font-medium">{selectedProduct.originCountry}</span>
                </div>
              )}
              {selectedProduct.volumeMl && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Volume:</span>
                  <span className="text-gray-900 font-medium">{selectedProduct.volumeMl}ml</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalQuickview;
