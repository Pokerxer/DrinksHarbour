"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import * as Icon from "react-icons/pi";
import { useModalQuickviewContext } from "@/context/ModalQuickviewContext";
import { useCart } from "@/context/CartContext";
import { useModalCartContext } from "@/context/ModalCartContext";
import { useWishlist } from "@/context/WishlistContext";
import { useModalWishlistContext } from "@/context/ModalWishlistContext";
import { useCompare } from "@/context/CompareContext";
import { useModalCompareContext } from "@/context/ModalCompareContext";
import Rate from "../Other/Rate";
import Link from "next/link";
import {
  getInitials,
  VENDOR_PALETTE,
  vendorPaletteIndex,
} from "@/data/vendor-helpers";

// Types
interface VendorSize {
  _id: string;
  size: string;
  displayName?: string;
  stock: number;
  availability?: string;
  price: number;
  originalPrice?: number;
  displayPrice?: string;
  currencySymbol?: string;
  discount?: { label?: string; percentage?: number } | null;
  volumeMl?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
}

interface Vendor {
  tenant: {
    _id: string;
    name: string;
    slug?: string;
    city?: string;
    state?: string;
    country?: string;
    logo?: string;
    primaryColor?: string;
    address?: {
      city?: string;
      state?: string;
      country?: string;
    };
  };
  sizes: {
    _id: string;
    size: string;
    stock: number;
    pricing: {
      websitePrice: number;
      currencySymbol?: string;
    };
  }[];
  isOnSale?: boolean;
  saleDiscountValue?: number;
  sku?: string;
}

const ModalQuickview: React.FC = () => {
  const { selectedProduct, isOpen, closeQuickview } =
    useModalQuickviewContext();
  const [activeImage, setActiveImage] = useState(0);
  const [activeSize, setActiveSize] = useState<string>("");
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [showAddedAnimation, setShowAddedAnimation] = useState(false);
  const [imageError, setImageError] = useState(false);

  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const { addToWishlist, removeFromWishlist, wishlistState } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const {
    addToCompare,
    removeFromCompare,
    compareState,
    isInCompare,
    maxCompareLimit,
  } = useCompare();
  const { openModalCompare } = useModalCompareContext();

  // Memoized values
  const isWishlistActive = useMemo(
    () =>
      selectedProduct &&
      wishlistState.wishlistArray.some(
        (item) => item.id === selectedProduct.id,
      ),
    [selectedProduct, wishlistState.wishlistArray],
  );

  const isCompareActive = useMemo(
    () => selectedProduct && isInCompare(selectedProduct.id),
    [selectedProduct, isInCompare],
  );

  const vendors = useMemo(
    () => selectedProduct?.availableAt || [],
    [selectedProduct],
  );

  const selectedVendor = useMemo(() => {
    if (!vendors.length) return null;
    if (activeVendor) {
      return vendors.find((v) => v.tenant?._id === activeVendor) ?? vendors[0];
    }
    return vendors[0];
  }, [vendors, activeVendor]);

  const vendorSizes: VendorSize[] = useMemo(() => {
    if (!selectedVendor) return [];
    return selectedVendor.sizes.map((s) => {
      const sizeData = s as any;
      return {
        _id: sizeData._id,
        size: sizeData.size,
        displayName: sizeData.displayName || sizeData.size,
        stock: sizeData.stock,
        availability: sizeData.availability,
        price: sizeData.pricing?.websitePrice || sizeData.price || 0,
        originalPrice:
          sizeData.pricing?.originalWebsitePrice || sizeData.originalPrice,
        displayPrice: sizeData.pricing?.displayPrice,
        currencySymbol: sizeData.pricing?.currencySymbol,
        discount: sizeData.discount,
        volumeMl: sizeData.volumeMl,
        minOrderQuantity: sizeData.minOrderQuantity || 1,
        maxOrderQuantity: sizeData.maxOrderQuantity,
      };
    });
  }, [selectedVendor]);

  const selectedSizeData = useMemo(() => {
    if (!activeSize || !vendorSizes.length) return null;
    return vendorSizes.find((s) => s.size === activeSize) || null;
  }, [activeSize, vendorSizes]);

  // Effects
  useEffect(() => {
    if (selectedProduct && vendors.length > 0 && !activeVendor) {
      setActiveVendor(vendors[0].tenant._id);
    }
  }, [selectedProduct, vendors, activeVendor]);

  useEffect(() => {
    if (vendorSizes.length > 0) {
      const firstAvailableSize = vendorSizes.find((s) => s.stock > 0);
      setActiveSize(firstAvailableSize?.size || vendorSizes[0].size);
    }
  }, [vendorSizes]);

  useEffect(() => {
    if (!isOpen) {
      setActiveImage(0);
      setActiveSize("");
      setActiveVendor(null);
      setQuantity(1);
      setIsAddingToCart(false);
      setShowAddedAnimation(false);
      setImageError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuickview();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeQuickview]);

  // Handlers
  const handleAddToCart = useCallback(async () => {
    if (!selectedProduct || !selectedSizeData || !selectedVendor) {
      console.log("Quickview: Missing data", {
        selectedProduct: !!selectedProduct,
        selectedSizeData: !!selectedSizeData,
        selectedVendor: !!selectedVendor,
      });
      return;
    }
    if (selectedSizeData.stock === 0) {
      return;
    }

    // Get vendor name with fallback
    const vendorName =
      selectedVendor.tenant?.name ||
      selectedVendor.tenant?.slug ||
      "Unknown Vendor";
    const vendorId = selectedVendor.tenant?._id;
    const sizeId = selectedSizeData?._id;
    const subProductId = selectedVendor._id;

    console.log("Quickview: Adding to cart", {
      vendorName,
      vendorId,
      sizeId,
      subProductId,
      fullVendor: selectedVendor,
    });

    setIsAddingToCart(true);

    try {
      await addToCart(
        selectedProduct,
        activeSize,
        "",
        vendorName,
        vendorId,
        quantity,
        sizeId,
        subProductId,
      );

      setShowAddedAnimation(true);
      setTimeout(() => {
        setShowAddedAnimation(false);
        openModalCart();
        closeQuickview();
      }, 800);
    } catch (error) {
      console.error("Error adding to cart:", error);
    } finally {
      setIsAddingToCart(false);
    }
  }, [
    selectedProduct,
    selectedSizeData,
    selectedVendor,
    activeSize,
    quantity,
    addToCart,
    openModalCart,
    closeQuickview,
  ]);

  const handleAddToWishlist = useCallback(() => {
    if (!selectedProduct) return;
    if (isWishlistActive) {
      removeFromWishlist(selectedProduct.id);
    } else {
      addToWishlist(selectedProduct);
    }
    openModalWishlist();
  }, [
    selectedProduct,
    isWishlistActive,
    removeFromWishlist,
    addToWishlist,
    openModalWishlist,
  ]);

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
  }, [
    selectedProduct,
    isCompareActive,
    removeFromCompare,
    addToCompare,
    openModalCompare,
  ]);

  const handleQuantityChange = useCallback(
    (change: number) => {
      if (!selectedSizeData) return;
      const newQuantity = quantity + change;
      const minQty = selectedSizeData.minOrderQuantity || 1;
      const maxQty =
        selectedSizeData.maxOrderQuantity || selectedSizeData.stock || 10;
      if (newQuantity >= minQty && newQuantity <= maxQty) {
        setQuantity(newQuantity);
      }
    },
    [quantity, selectedSizeData],
  );

  // Computed display values
  const displayPrice =
    selectedSizeData?.price || selectedProduct?.priceRange?.min || 0;
  const displayOriginalPrice =
    selectedSizeData?.originalPrice || selectedProduct?.priceRange?.max || 0;
  const displayCurrencySymbol = selectedSizeData?.currencySymbol || "₦";
  const discountPercentage = useMemo(() => {
    if (selectedSizeData?.discount?.percentage) {
      return selectedSizeData.discount.percentage;
    }
    if (displayOriginalPrice > displayPrice && displayOriginalPrice > 0) {
      return Math.floor(
        ((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100,
      );
    }
    return 0;
  }, [selectedSizeData, displayOriginalPrice, displayPrice]);
  const inStock = (selectedSizeData?.stock || 0) > 0;

  if (!selectedProduct) return null;

  const images = selectedProduct?.images || [];
  const mainImage =
    images[activeImage]?.url ||
    selectedProduct?.primaryImage?.url ||
    selectedProduct?.thumbImage?.[0];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 transition-all duration-300 ${
        isOpen
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none"
      }`}
      onClick={closeQuickview}
    >
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/50 lg:bg-black/40 backdrop-blur-sm transition-opacity" />

      {/* Modal Content - Full screen on mobile, card on desktop */}
      <div
        className={`relative bg-white rounded-t-3xl lg:rounded-3xl shadow-2xl w-full lg:max-w-5xl max-h-[95vh] lg:max-h-[90vh] overflow-hidden transition-all duration-500 flex flex-col ${
          isOpen
            ? "translate-y-0 opacity-100"
            : "translate-y-full lg:translate-y-8 lg:scale-95 lg:opacity-0"
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

        {/* Close Button - Fixed position */}
        <button
          className="absolute top-3 right-3 z-40 w-10 h-10 flex items-center justify-center rounded-full bg-white lg:bg-gray-100 shadow-lg hover:bg-gray-200 transition-colors"
          onClick={closeQuickview}
          aria-label="Close quick view"
        >
          <Icon.PiX size={22} />
        </button>

        {/* Mobile Drag Handle */}
        <div className="lg:hidden flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        <div className="flex flex-col lg:flex-row h-full overflow-y-auto">
          {/* LEFT: Images */}
          <div className="lg:w-[45%] bg-gray-50 p-4 lg:p-6 flex flex-col sticky top-0 lg:static">
            {/* Main Image */}
            <div className="relative aspect-square rounded-xl lg:rounded-2xl overflow-hidden bg-white shadow-sm flex-shrink-0 group">
              {mainImage && !imageError ? (
                <Image
                  src={mainImage}
                  alt={selectedProduct.name}
                  fill
                  className="object-cover transition-transform duration-500"
                  priority
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                  <Icon.PiImage size={64} className="mb-2" />
                  <span className="text-sm">Image not available</span>
                </div>
              )}

              {/* Discount Badge */}
              {discountPercentage > 0 && (
                <div className="absolute top-3 left-3 px-2.5 py-1 lg:px-3 lg:py-1.5 bg-red-500 text-white text-xs lg:text-sm font-bold rounded-full shadow-lg">
                  -{discountPercentage}%
                </div>
              )}

              {/* ABV Badge for beverages */}
              {selectedProduct.abv && (
                <div className="absolute top-3 right-3 px-2.5 py-1 lg:px-3 lg:py-1.5 bg-gray-900/80 backdrop-blur-sm text-white text-xs font-bold rounded-full shadow-lg">
                  {selectedProduct.abv}% ABV
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

              {/* Image Navigation Arrows - Always visible on mobile */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setActiveImage((prev) =>
                        prev === 0 ? images.length - 1 : prev - 1,
                      )
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    <Icon.PiCaretLeft size={20} />
                  </button>
                  <button
                    onClick={() =>
                      setActiveImage((prev) =>
                        prev === images.length - 1 ? 0 : prev + 1,
                      )
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
                  >
                    <Icon.PiCaretRight size={20} />
                  </button>
                </>
              )}
            </div>

            {/* Thumbnail Gallery - Scrollable */}
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 lg:mt-4 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => {
                      setActiveImage(index);
                      setImageError(false);
                    }}
                    className={`relative w-14 h-14 lg:w-16 lg:h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${
                      activeImage === index
                        ? "border-orange-500 shadow-md"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    <Image
                      src={img.url}
                      alt={img.alt || `${selectedProduct.name} ${index + 1}`}
                      fill
                      className="object-cover"
                      sizes="56px"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Product Info */}
          <div className="lg:w-[55%] p-4 lg:p-8 pb-44 lg:pb-8 overflow-y-auto">
            {/* Vendor Banner - Always visible */}
            {vendors.length > 0 && selectedVendor && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl border border-orange-100">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm"
                  style={{
                    backgroundColor:
                      VENDOR_PALETTE[
                        vendorPaletteIndex(selectedVendor.tenant.name)
                      ],
                  }}
                >
                  {typeof selectedVendor.tenant.logo === "string" ? (
                    <Image
                      src={selectedVendor.tenant.logo}
                      alt=""
                      width={48}
                      height={48}
                      className="rounded-xl"
                    />
                  ) : (
                    getInitials(selectedVendor.tenant.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-orange-600 font-medium uppercase tracking-wide">
                      Sold by
                    </span>
                  </div>
                  <p className="text-base font-bold text-gray-900 truncate">
                    {selectedVendor.tenant.name}
                  </p>
                  {selectedVendor.tenant.city && (
                    <p className="text-xs text-gray-500 truncate">
                      {selectedVendor.tenant.city},{" "}
                      {selectedVendor.tenant.country || "Nigeria"}
                    </p>
                  )}
                </div>
                {vendors.length > 1 && (
                  <button
                    onClick={() => {
                      const currentIndex = vendors.findIndex(
                        (v) => v.tenant._id === selectedVendor.tenant._id,
                      );
                      const nextIndex = (currentIndex + 1) % vendors.length;
                      setActiveVendor(vendors[nextIndex].tenant._id);
                    }}
                    className="px-3 py-1.5 bg-white rounded-lg text-xs font-medium text-orange-600 hover:bg-orange-100 transition-colors border border-orange-200"
                  >
                    Change
                  </button>
                )}
              </div>
            )}

            {/* Vendor Selection - Desktop only (when multiple vendors) */}
            {vendors.length > 1 && (
              <div className="hidden lg:block mb-4 lg:mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <Icon.PiStorefront size={18} />
                  Other Sellers ({vendors.length - 1})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {vendors
                    .filter((v) => v.tenant._id !== selectedVendor?.tenant._id)
                    .map((vendor: Vendor) => {
                      const bg =
                        VENDOR_PALETTE[vendorPaletteIndex(vendor.tenant.name)];
                      return (
                        <button
                          key={vendor.tenant._id}
                          onClick={() => setActiveVendor(vendor.tenant._id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all ${"border-gray-200 hover:border-orange-300 text-gray-700 hover:bg-orange-50"}`}
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: bg }}
                          >
                            {typeof vendor.tenant.logo === "string" ? (
                              <Image
                                src={vendor.tenant.logo}
                                alt=""
                                width={24}
                                height={24}
                                className="rounded-full"
                              />
                            ) : (
                              getInitials(vendor.tenant.name)
                            )}
                          </div>
                          <span className="hidden xl:inline">
                            {vendor.tenant.name}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Brand & Title */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                {selectedProduct.brand && (
                  <p className="text-xs lg:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    {typeof selectedProduct.brand === "object"
                      ? selectedProduct.brand.name
                      : selectedProduct.brand}
                  </p>
                )}
                <h1 className="text-xl lg:text-2xl xl:text-3xl font-bold text-gray-900 leading-tight line-clamp-2">
                  {selectedProduct.name}
                </h1>
              </div>
              <button
                onClick={handleAddToWishlist}
                className={`w-10 h-10 lg:w-12 lg:h-12 flex items-center justify-center rounded-full border-2 transition-all flex-shrink-0 ${
                  isWishlistActive
                    ? "border-red-500 bg-red-50 text-red-500"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {isWishlistActive ? (
                  <Icon.PiHeartFill size={20} />
                ) : (
                  <Icon.PiHeart size={20} />
                )}
              </button>
            </div>

            {/* Rating */}
            <div className="flex items-center gap-2 lg:gap-3 mb-4">
              <Rate
                currentRate={
                  selectedProduct.stats?.averageRating ||
                  selectedProduct.rate ||
                  0
                }
                size={14}
              />
              <span className="text-xs lg:text-sm text-gray-600">
                <span className="font-semibold">
                  {(
                    selectedProduct.stats?.averageRating ||
                    selectedProduct.rate ||
                    0
                  ).toFixed(1)}
                </span>
                <span className="text-gray-400 ml-1">
                  (
                  {selectedProduct.stats?.totalReviews ||
                    selectedProduct.reviewCount ||
                    0}
                  )
                </span>
              </span>
            </div>

            {/* Price */}
            <div className="flex flex-wrap items-baseline gap-2 lg:gap-3 mb-4 pb-3 lg:pb-4 border-b border-gray-100">
              <span className="text-2xl lg:text-3xl font-bold text-gray-900">
                {displayCurrencySymbol}
                {displayPrice.toLocaleString()}
              </span>
              {displayOriginalPrice > displayPrice && (
                <span className="text-lg lg:text-xl text-gray-400 line-through">
                  {displayCurrencySymbol}
                  {displayOriginalPrice.toLocaleString()}
                </span>
              )}
              {discountPercentage > 0 && (
                <span className="px-2 lg:px-3 py-0.5 lg:py-1 bg-green-100 text-green-700 text-xs lg:text-sm font-bold rounded-full">
                  Save {discountPercentage}%
                </span>
              )}
            </div>

            {/* Short Description */}
            {selectedProduct.shortDescription && (
              <p className="text-sm text-gray-600 mb-4 lg:mb-5 leading-relaxed line-clamp-3">
                {selectedProduct.shortDescription}
              </p>
            )}

            {/* Size Selection */}
            {vendorSizes.length > 0 && (
              <div className="mb-4 lg:mb-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon.PiRuler size={18} />
                    Select Size
                  </span>
                  {selectedSizeData && (
                    <span
                      className={`text-xs font-medium ${selectedSizeData.stock > 10 ? "text-green-600" : selectedSizeData.stock > 0 ? "text-amber-600" : "text-red-500"}`}
                    >
                      {selectedSizeData.stock > 10
                        ? "✓ In Stock"
                        : selectedSizeData.stock > 0
                          ? `Only ${selectedSizeData.stock} left`
                          : "✗ Out of Stock"}
                    </span>
                  )}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {vendorSizes.map((size: VendorSize) => {
                    const isSelected = activeSize === size.size;
                    const isOutOfStock = size.stock === 0;
                    const hasDiscount =
                      size.originalPrice && size.originalPrice > size.price;

                    return (
                      <button
                        key={size.size}
                        onClick={() =>
                          !isOutOfStock && setActiveSize(size.size)
                        }
                        disabled={isOutOfStock}
                        className={`relative px-3 lg:px-4 py-2 lg:py-3 rounded-xl border-2 transition-all min-w-[70px] lg:min-w-[80px] ${
                          isSelected
                            ? "border-orange-500 bg-orange-500 text-white shadow-lg"
                            : isOutOfStock
                              ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed line-through"
                              : "border-gray-200 bg-white text-gray-900 hover:border-orange-300"
                        }`}
                      >
                        <div className="text-xs lg:text-sm font-bold">
                          {size.displayName}
                        </div>
                        {size.volumeMl && (
                          <div
                            className={`text-[10px] lg:text-xs ${isSelected ? "text-orange-100" : "text-gray-500"}`}
                          >
                            {size.volumeMl}ml
                          </div>
                        )}
                        <div
                          className={`text-xs lg:text-sm font-semibold ${isSelected ? "text-white" : "text-gray-900"}`}
                        >
                          {size.currencySymbol}
                          {size.price.toLocaleString()}
                        </div>
                        {hasDiscount && !isOutOfStock && (
                          <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] lg:text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            -
                            {Math.round(
                              ((size.originalPrice! - size.price) /
                                size.originalPrice!) *
                                100,
                            )}
                            %
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                            <Icon.PiCheck
                              size={10}
                              className="text-orange-500"
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quantity & Add to Cart - Fixed bottom on mobile */}
            <div className="fixed bottom-0 left-0 right-0 lg:relative bg-white lg:bg-transparent p-3 lg:p-0 border-t lg:border-t-0 border-gray-100 lg:mb-4 z-30 shadow-lg lg:shadow-none">
              <div className="flex flex-col gap-2">
                {/* Row 1: Compare + Quantity + View Details */}
                <div className="flex items-center gap-2">
                  {/* Compare Button - Mobile */}
                  <button
                    onClick={handleAddToCompare}
                    disabled={
                      !isCompareActive &&
                      compareState.compareArray.length >= maxCompareLimit
                    }
                    className={`hidden lg:flex items-center justify-center w-12 h-12 rounded-xl border-2 font-medium transition-all ${
                      isCompareActive
                        ? "border-orange-500 text-orange-600 bg-orange-50"
                        : "border-gray-200 text-gray-700 hover:bg-gray-50"
                    } ${!isCompareActive && compareState.compareArray.length >= maxCompareLimit ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isCompareActive ? (
                      <Icon.PiCheck size={18} />
                    ) : (
                      <Icon.PiArrowsCounterClockwise size={18} />
                    )}
                  </button>

                  {/* Quantity Selector */}
                  <div className="flex-1 flex items-center bg-gray-50 rounded-xl border-2 border-gray-200 p-1">
                    <button
                      onClick={() => handleQuantityChange(-1)}
                      disabled={
                        quantity <= (selectedSizeData?.minOrderQuantity || 1)
                      }
                      className="w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-gray-100 disabled:opacity-40 transition-colors active:scale-95"
                    >
                      <Icon.PiMinus size={14} />
                    </button>
                    <span className="flex-1 text-center font-bold text-sm">
                      {quantity}
                    </span>
                    <button
                      onClick={() => handleQuantityChange(1)}
                      disabled={
                        selectedSizeData?.maxOrderQuantity
                          ? quantity >= selectedSizeData.maxOrderQuantity
                          : false
                      }
                      className="w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg bg-white shadow-sm hover:bg-gray-100 disabled:opacity-40 transition-colors active:scale-95"
                    >
                      <Icon.PiPlus size={14} />
                    </button>
                  </div>

                  {/* Mobile: View Details Button */}
                  <Link
                    href={`/product/${selectedProduct.slug}`}
                    className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
                    onClick={closeQuickview}
                  >
                    <Icon.PiArrowRight size={18} />
                  </Link>
                </div>

                {/* Row 2: Add to Cart - Full width */}
                <button
                  onClick={handleAddToCart}
                  disabled={!inStock || !activeSize || isAddingToCart}
                  className={`w-full py-2.5 lg:py-3 px-4 rounded-xl font-bold text-sm lg:text-base transition-all flex items-center justify-center gap-2 ${
                    !activeSize
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : !inStock
                        ? "bg-red-100 text-red-600 cursor-not-allowed"
                        : "bg-gray-900 text-white hover:bg-gray-800 shadow-lg"
                  }`}
                >
                  {isAddingToCart ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : !activeSize ? (
                    <>
                      <Icon.PiWarningCircle size={16} />
                      Select Size
                    </>
                  ) : !inStock ? (
                    <>
                      <Icon.PiProhibit size={16} />
                      Out of Stock
                    </>
                  ) : (
                    <>
                      <Icon.PiShoppingCart size={16} />
                      Add to Cart
                      <span className="text-xs opacity-70">
                        ({displayCurrencySymbol}
                        {(displayPrice * quantity).toLocaleString()})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Product Meta - Responsive grid */}
            <div className="mt-4 lg:mt-5 pt-4 lg:pt-5 border-t border-gray-100 grid grid-cols-2 gap-2 lg:gap-3 text-xs lg:text-sm">
              {selectedProduct.sku && (
                <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">SKU:</span>
                  <span className="text-gray-900 font-medium truncate">
                    {selectedProduct.sku}
                  </span>
                </div>
              )}
              {selectedProduct.abv && (
                <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Alcohol:</span>
                  <span className="text-gray-900 font-medium">
                    {selectedProduct.abv}% ABV
                  </span>
                </div>
              )}
              {selectedProduct.originCountry && (
                <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Origin:</span>
                  <span className="text-gray-900 font-medium">
                    {selectedProduct.originCountry}
                  </span>
                </div>
              )}
              {selectedProduct.volumeMl && (
                <div className="flex justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-500">Volume:</span>
                  <span className="text-gray-900 font-medium">
                    {selectedProduct.volumeMl}ml
                  </span>
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
