'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import Marquee from 'react-fast-marquee';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import { useCompare } from '@/context/CompareContext';
import { useModalCompareContext } from '@/context/ModalCompareContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { ProductType } from '@/types/product.types';
import { getInitials, VENDOR_PALETTE, vendorPaletteIndex } from '@/data/vendor-helpers';

interface BeverageProduct {
  _id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  images: Array<{
    url: string;
    alt: string;
    isPrimary?: boolean;
    order?: number;
    resourceType?: string;
    tags?: string[];
    uploadedAt?: string;
  }>;
  primaryImage: {
    url: string;
    alt: string;
    isPrimary?: boolean;
    order?: number;
    resourceType?: string;
    tags?: string[];
    uploadedAt?: string;
  };
  priceRange: {
    min: number;
    max: number;
    currency: string;
    display: string;
  };
  sizeVariants: string[];
  flavors: Array<{
    _id: string;
    name: string;
    value: string;
    color?: string;
  }>;
  rate?: number;
  reviewCount?: number;
  totalSold?: number;
  stockInfo: {
    totalStock: number;
    availableStock: number;
    tenants: number;
    totalSizes: number;
  };
  availability: {
    status: string;
    stockLevel: string;
    availableFrom: number;
    message?: string;
  };
  badge?: {
    name: string;
    type: string;
    color?: string;
  };
  sale?: boolean;
  isOnSale?: boolean;
  createdAt: string;
  updatedAt: string;
  brand: {
    _id: string;
    name: string;
    slug: string;
  };
  category?: {
    name: string;
    slug: string;
  };
  subCategory?: {
    name: string;
    slug: string;
  };
  sku?: string;
  abv?: number;
  originCountry?: string;
  isAlcoholic?: boolean;
  shippingInfo?: string;
  availableAt: Array<{
    _id: string;
    sku: string;
    tenant: {
      _id: string;
      name: string;
      slug: string;
      primaryColor?: string;
      city?: string;
      state?: string;
      country?: string;
      logo?: { url: string };
    };
    sizes: Array<{
      _id: string;
      size: string;
      volumeMl: number;
      sku: string;
      isDefault: boolean;
      stock: number;
      availability: string;
      isOnSale: boolean;
      pricing: {
        costPrice: number;
        sellingPrice: number;
        tenantPrice: number;
        websitePrice: number;
        originalWebsitePrice: number;
        platformFee: number;
        tenantRevenue: number;
        platformRevenue: number;
        displayPrice: string;
        compareAtPrice: string;
        currency: string;
        currencySymbol: string;
        revenueModel: string;
        markupPercentage?: number;
        commissionPercentage?: number;
      };
      discount?: { label: string } | null;
      metadata?: {
        priceCalculatedAt: string;
        taxIncluded: boolean;
      };
    }>;
    priceRange: {
      min: number;
      max: number;
      display: string;
      currency: string;
    };
    totalStock: number;
    availableSizes: number;
    isFeatured: boolean;
    isOnSale: boolean;
  }>;
  region?: string;
  foodPairings?: string[];
  tastingNotes?: {
    nose: string[];
    aroma: string[];
    palate: string[];
    taste: string[];
    finish: string[];
    mouthfeel: string[];
  };
  servingSuggestions?: {
    garnish: string[];
    mixers: string[];
  };
  tags?: Array<{
    _id: string;
    name: string;
    slug: string;
    color: string;
  }>;
  awards?: Array<{
    name: string;
    year: number;
    category: string;
  }>;
  type: string;
  volumeMl?: number;
  discount?: {
    percentage: number;
    amount: number;
    type: string;
  } | null;
  isFeatured?: boolean;
  status?: string;
  tenantCount?: number;
  averageRating?: number;
}

type ProductData = ProductType | BeverageProduct;

interface ProductProps {
  data: ProductData;
  type: 'grid' | 'list';
}

// Tooltip Button Component
interface TooltipButtonProps {
  label: string;
  onClick: (e: React.MouseEvent) => void;
  isActive?: boolean;
  activeColor?: string;
  ariaLabel: string;
  children: React.ReactNode;
  className?: string;
}

const TooltipButton: React.FC<TooltipButtonProps> = ({ 
  label, 
  onClick, 
  isActive = false, 
  activeColor = 'bg-black-900',
  ariaLabel,
  children,
  className = ''
}) => {
  return (
    <button
      className={`flex items-center justify-center rounded-full bg-gray-50 duration-300 relative transition-all group/tooltip ${
        isActive 
          ? `${activeColor} text-white` 
          : 'hover:bg-black-900 hover:text-gray-50'
      } ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {/* Tooltip - hidden on mobile */}
      <div className="hidden md:block absolute right-full mr-2 top-1/2 -translate-y-1/2 opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-50">
        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
          {label}
          <div className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      </div>
      {children}
    </button>
  );
};

// Vendor Avatar Component with Tooltip
interface VendorAvatarProps {
  vendor: any;
  isActive: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md';
}

const VendorAvatar: React.FC<VendorAvatarProps> = ({ vendor, isActive, onClick, size = 'sm' }) => {
  const bg = VENDOR_PALETTE[vendorPaletteIndex(vendor.tenant.name)];
  const dimensions = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative group/avatar"
      aria-label={`Select vendor ${vendor.tenant.name}`}
      aria-pressed={isActive}
    >
      <div
        className={`${dimensions} rounded-full flex items-center justify-center text-gray-50 text-xs font-bold select-none transition-all duration-200 ${
          isActive
            ? 'ring-2 ring-offset-1 ring-black'
            : 'ring-1 ring-gray-200 hover:scale-105'
        }`}
        style={{ backgroundColor: bg }}
      >
        {vendor.tenant.logo?.url ? (
          <Image
            src={vendor.tenant.logo.url}
            width={size === 'sm' ? 28 : 32}
            height={size === 'sm' ? 28 : 32}
            alt={vendor.tenant.name}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          getInitials(vendor.tenant.name)
        )}
      </div>
      {/* Tooltip - hidden on mobile */}
      <div className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover/avatar:opacity-100 group-hover/avatar:visible transition-all duration-200 z-50">
        <div className="bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
          {vendor.tenant.name}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      </div>
    </button>
  );
};



const ProductCard: React.FC<ProductProps> = ({ data, type = 'grid' }) => {
  const router = useRouter();
  const [activeColor, setActiveColor] = useState<string>('');
  const [activeSize, setActiveSize] = useState<string>('');
  const [openQuickShop, setOpenQuickShop] = useState<boolean>(false);
  const [activeVendor, setActiveVendor] = useState<string | null>(null);
  const productCardRef = useRef<HTMLDivElement>(null);

  const { cartState, addToCart, updateCart, updateQuantity, getCartItemId } = useCart();
  const { openModalCart } = useModalCartContext();
  const { addToWishlist, removeFromWishlist, wishlistState } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const { addToCompare, removeFromCompare, compareState, isInCompare } = useCompare();
  const { openModalCompare } = useModalCompareContext();
  const { openQuickview } = useModalQuickviewContext();

  // Helper function to determine if data is BeverageProduct
  const isBeverageProduct = (product: ProductData): product is BeverageProduct => {
    return 'flavors' in product && 'priceRange' in product;
  };

  const FLAVOR_COLOR_MAP: Record<string, string> = {
    citrus: '#FFD700',
    sweet: '#FF69B4',
    caramel: '#D2691E',
    fruity: '#FF4500',
    tropical: '#32CD32',
    berry: '#9370DB',
    herbal: '#228B22',
    spicy: '#DC143C',
    floral: '#FF1493',
    oak: '#8B4513',
    smoky: '#2F4F4F',
    chocolate: '#8B4513',
    coffee: '#654321',
    vanilla: '#F5DEB3',
    honey: '#FFD700',
    mint: '#98FB98',
    apple: '#9ACD32',
    grape: '#6A5ACD',
    orange: '#FFA500',
    lemon: '#FFFF00',
    peach: '#FFDAB9',
    mango: '#FF8C00',
    cola: '#8B0000',
    ginger: '#DAA520',
    tea: '#D2B48C',
  };

  // Helper function to get color code for flavor
  const getFlavorColor = (flavorName: string): string => {
    if (!flavorName) return '#808080';
    const normalizedName = flavorName.toLowerCase().trim();
    return FLAVOR_COLOR_MAP[normalizedName] || (flavorName.startsWith('#') ? flavorName : '#808080');
  };

  // Helper to determine if product is new (within 7 days)
  const isProductNew = (createdAt: string): boolean => {
    try {
      const createdDate = new Date(createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdDate > weekAgo;
    } catch {
      return false;
    }
  };

  // Map beverage product to ProductType structure
  const mappedProduct = useMemo((): ProductType => {
    if (isBeverageProduct(data)) {
      const imageUrls: string[] = [];
      if (data.primaryImage?.url) {
        imageUrls.push(data.primaryImage.url);
      }
      if (data.images && data.images.length > 0) {
        const additionalImages = data.images
          .filter((img) => img.url && img.url !== data.primaryImage?.url)
          .map((img) => img.url);
        imageUrls.push(...additionalImages.slice(0, 2));
      }
      if (imageUrls.length === 0) {
        imageUrls.push('/images/placeholder-product.png');
      }

      const variations = (data.flavors || []).map((flavor, index) => ({
        id: `flavor-${data._id || (data as any).id}-${index}`,
        color: flavor.name,
        colorCode: flavor.color || getFlavorColor(flavor.name),
        colorImage: data.primaryImage?.url || imageUrls[0] || '',
        size: [] as string[],
        quantity: data.stockInfo?.totalStock || 0,
        image: data.primaryImage?.url || imageUrls[0] || '',
      }));

      const sizes = (data.availableAt || []).flatMap((store) =>
        store.sizes.map((size) => ({
          size: size.size,
          displayName: size.size,
          priceRange: {
            min: size.pricing.websitePrice,
            max: size.pricing.websitePrice,
          },
        }))
      );

      const uniqueSizes = Array.from(new Map(sizes.map((item) => [item.size, item])).values());

      const allPrices = (data.availableAt || []).flatMap((store) =>
        store.sizes.map((size) => size.pricing.websitePrice)
      );
      const minPrice = allPrices.length > 0 ? Math.min(...allPrices) : 0;
      const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) : minPrice;

      const isNew = data.badge?.type === 'new-arrival' || isProductNew(data.createdAt);

      console.log(data.images, 'data.images');
      return {
        id: data._id,
        slug: data.slug,
        name: data.name,
        availability: {
          message: data.availability?.message,
          status: data.availability?.status,
          stockLevel: data.availability?.stockLevel,
          totalStock: data.stockInfo?.totalStock || 0,
          inStock: (data.stockInfo?.totalStock || 0) > 0,
        },
        thumbImage: imageUrls,
        variation: variations,
        sizes: uniqueSizes,
        sold: data.totalSold || 0,
        quantity: data.stockInfo?.totalStock || 100,
        price: minPrice,
        originPrice: maxPrice,
        sale: data.isOnSale,
        new: isNew,
        rating: data.averageRating || data.rate || 0,
        reviewCount: data.reviewCount || 0,
        action: variations.length > 0 ? 'quick shop' : 'add to cart',
        category: {
          name: data.category?.name,
          type: 'beverage',
          slug: data.category?.slug,
        },
        subCategory: data.subCategory?.name || '',
        type: data.category?.name || 'beverage',
        brand: {
          name: data.brand?.name || '',
          _id: data.brand?._id,
          slug: data.brand?.slug,
        },
        quantityPurchase: 1,
        description: data.description || data.shortDescription || `${data.name} - Premium beverage`,
        images: imageUrls.map((url) => ({ url, alt: data.name })),
        variants: [],
        discount: data.discount?.percentage,
        weight: 0,
        dimensions: '',
        shippingInfo: data.shippingInfo || 'Free shipping on orders over $50',
        tags: (data.tags || []).map((tag) => tag.name),
        sku: data.sku || data.availableAt?.[0]?.sku,
        status: (data.status as any) || 'published',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        badge: data.badge && data.badge.name
          ? {
              type: data.badge.type || '',
              name: data.badge.name || '',
              color: data.badge.color || '#000000',
            }
          : undefined,
        abv: data.abv,
        originCountry: data.originCountry,
        isAlcoholic: data.isAlcoholic,
        availableAt: data.availableAt,
        region: data.region || data.originCountry,
        foodPairing: data.foodPairings,
        tastingNotes: data.tastingNotes,
        shortDescription: data.shortDescription,
        servingSuggestions: data.servingSuggestions,
        awards: data.awards,
        volumeMl: data.volumeMl,
        tenantCount: data.tenantCount,
        isFeatured: data.isFeatured,
      } as ProductType;
    } else {
      return {
        ...data,
        quantityPurchase: data.quantityPurchase || 1,
        price: data.price || 0,
        originPrice: data.originPrice || data.price || 0,
        thumbImage: data.thumbImage || [],
        variation: data.variation || [],
        sizes: data.sizes || [],
        sold: data.sold || 0,
        quantity: data.quantity || 100,
        action: data.action || 'add to cart',
        badge: 'badge' in data ? (data as any).badge : undefined,
        rate: data.rate || 4.5,
      } as ProductType;
    }
  }, [data]);

  // Vendor (availableAt) derived state
  const vendors = isBeverageProduct(data) && Array.isArray(data.availableAt) ? data.availableAt : [];

  const selectedVendor = useMemo(() => {
    if (!vendors.length) return null;
    if (activeVendor) return vendors.find((v) => v.tenant._id === activeVendor) ?? vendors[0];
    return vendors[0];
  }, [vendors, activeVendor]);

  /** Sizes exposed by the currently-selected vendor */
  const vendorSizes = useMemo(() => {
    if (!selectedVendor) return [];
    return selectedVendor.sizes.map((s) => ({
      size: s.size,
      displayName: s.size,
      stock: s.stock,
      price: s.pricing.websitePrice,
      currencySymbol: s.pricing.currencySymbol,
    }));
  }, [selectedVendor]);

  // Reset size pick whenever the vendor switches
  useEffect(() => {
    setActiveSize('');
  }, [activeVendor]);

  // Calculate discount - only when there's an actual sale (isOnSale=true or discount with source='sale')
  const percentSale = Math.floor(
    100 - (mappedProduct.price / (mappedProduct.originPrice || mappedProduct.price || 1)) * 100
  );

  // Check if product has an actual sale (not just price differences between sizes)
  const hasActiveSale = vendors.some((v) => v.isOnSale === true);
  
  // Get the actual discount percentage from sale data
  const saleDiscount = vendors.find((v) => v.isOnSale === true)?.saleDiscountValue || 
    vendors.find((v) => v.isOnSale === true)?.saleType === 'percentage' ? 
    vendors.find((v) => v.isOnSale === true)?.saleDiscountValue : 0;

  // Calculate discount from sizes that have active sale discounts
  const sizeSaleDiscount = Math.max(
    0,
    ...vendors.flatMap((v) => 
      v.sizes
        .filter((s) => s.discount?.source === 'sale' && s.discount?.value > 0)
        .map((s) => s.discount.value)
    )
  );

  const calculatedDiscount = saleDiscount || sizeSaleDiscount || (percentSale > 0 ? percentSale : 0);

  const handleActiveColor = (item: string) => {
    setActiveColor(item);
  };

  const handleActiveSize = (item: string) => {
    setActiveSize(item);
  };

  const handleAddToCart = useCallback(() => {
    // Get vendor info
    const selectedVendorData = data?.availableAt?.find((v: any) => 
      v.sizes.some((s: any) => s.size === activeSize)
    ) || data?.availableAt?.[0];
    
    const vendorName = selectedVendorData?.tenant?.name || '';
    const vendorId = selectedVendorData?.tenant?._id || '';
    const sizeId = selectedVendorData?.sizes?.find((s: any) => s.size === activeSize)?._id || '';
    const subProductId = selectedVendorData?._id || '';
    
    const cartItemId = getCartItemId(mappedProduct.id, activeSize, vendorName, activeColor);
    const existingItem = cartState.cartArray.find((item) => item.cartItemId === cartItemId);
    
    if (existingItem) {
      updateQuantity(cartItemId, (existingItem.quantity || 1) + 1);
    } else {
      addToCart(mappedProduct, activeSize, activeColor, vendorName, vendorId, undefined, sizeId, subProductId);
    }
    openModalCart();
    setOpenQuickShop(false);
  }, [cartState, mappedProduct, activeSize, activeColor, data, addToCart, updateQuantity, getCartItemId, openModalCart]);

  const handleAddToWishlist = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id)) {
      removeFromWishlist(mappedProduct.id);
    } else {
      addToWishlist(mappedProduct);
    }
    openModalWishlist();
  }, [wishlistState, mappedProduct, removeFromWishlist, addToWishlist, openModalWishlist]);

  const handleAddToCompare = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Check if already in compare first
    if (isInCompare(mappedProduct.id)) {
      // Product is already in compare, remove it
      removeFromCompare(mappedProduct.id);
      openModalCompare();
    } else {
      // Try to add to compare
      const result = addToCompare(mappedProduct);
      
      if (result.success) {
        openModalCompare();
      } else {
        // Show error - limit reached
        openModalCompare();
      }
    }
  }, [mappedProduct, addToCompare, removeFromCompare, isInCompare, openModalCompare]);

  const handleQuickviewOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openQuickview(mappedProduct);
  }, [mappedProduct, openQuickview]);

  const handleDetailProduct = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/product/${mappedProduct.slug}`);
  }, [mappedProduct.slug, router]);

  // Handle card click to navigate to product page
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    // If clicking on interactive elements, don't navigate
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('.quick-shop-block')) {
      return;
    }
    // Navigate to product page on card click
    router.push(`/product/${mappedProduct.slug}`);
  }, [mappedProduct.slug, router]);

  // Mobile Add to Cart - uses first available size with enhanced feedback
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  
  const handleMobileAddToCart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (vendorSizes.length > 0) {
      setIsAddingToCart(true);
      
      const firstAvailableSize = vendorSizes.find(s => s.stock > 0) || vendorSizes[0];
      const sizeToUse = firstAvailableSize.size;
      
      // Get vendor info from the vendorSizes mapping
      const selectedVendor = data?.availableAt?.[0];
      const vendorName = selectedVendor?.tenant?.name || '';
      const vendorId = selectedVendor?.tenant?._id || '';
      const sizeId = firstAvailableSize?._id || '';
      const subProductId = selectedVendor?._id || '';
      
      const cartItemId = getCartItemId(mappedProduct.id, sizeToUse, vendorName, '');
      const existingItem = cartState.cartArray.find((item) => item.cartItemId === cartItemId);
      
      if (existingItem) {
        updateQuantity(cartItemId, (existingItem.quantity || 1) + 1);
      } else {
        addToCart(mappedProduct, sizeToUse, '', vendorName, vendorId, undefined, sizeId, subProductId);
      }
      
      // Show feedback animation
      setTimeout(() => {
        setIsAddingToCart(false);
        openModalCart();
      }, 300);
    }
  }, [cartState, mappedProduct, vendorSizes, data, addToCart, updateQuantity, getCartItemId, openModalCart]);

  // Image loading state
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Card entrance animation state
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    
    return () => observer.disconnect();
  }, []);

  return (
    <>
      {type === 'grid' ? (
        <div 
          ref={cardRef}
          className={`product-item grid-type style-1 group h-full transform transition-all duration-700 ease-out ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
          style={{ transitionDelay: `${(productCardRef.current ? 0 : Math.random() * 200)}ms` }}
        >
          <div 
            className="product-main cursor-pointer block h-full flex flex-col transform transition-transform duration-300 hover:-translate-y-2"
            onClick={handleCardClick}
          >
            <div className="product-thumb bg-gray-50 relative overflow-hidden rounded-xl md:rounded-2xl transition-all duration-500 ease-out group-hover:shadow-2xl group-hover:shadow-black/10 group-hover:scale-[1.02]">
              {/* Sale Badge - Only show when there's an actual sale */}
              {hasActiveSale && calculatedDiscount > 0 && (
                <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-full transform -rotate-2 group-hover:rotate-0 transition-transform duration-300 shadow-lg animate-pulse">
                  SALE {calculatedDiscount}% OFF
                </div>
              )}

              {/* Beverage Product Badge Overlay */}
              {isBeverageProduct(data) && data.badge && data.badge.name && (
                <div
                  className={`absolute z-10 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full text-[10px] md:text-xs font-bold text-gray-50 transform transition-all duration-300 group-hover:scale-105 ${hasActiveSale ? 'top-12 left-2' : 'top-2 left-2'}`}
                  style={{ backgroundColor: data.badge?.color || '#10B981' }}
                >
                  {data.badge.name.toUpperCase()}
                </div>
              )}

              {/* Right Side Actions - Desktop only with staggered animation */}
              <div className="hidden lg:flex flex-col gap-2 absolute top-3 right-3 z-20">
                <TooltipButton
                  label={wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id)
                    ? 'Remove From Wishlist'
                    : 'Add To Wishlist'}
                  onClick={handleAddToWishlist}
                  isActive={wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id)}
                  activeColor="bg-red-500"
                  ariaLabel="Toggle wishlist"
                  className="w-8 h-8 transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 delay-75 hover:scale-110"
                >
                  {wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id) ? (
                    <Icon.PiHeartFill size={16} className="text-gray-50 animate-bounce" />
                  ) : (
                    <Icon.PiHeart size={16} />
                  )}
                </TooltipButton>
                <TooltipButton
                  label="Compare Product"
                  onClick={handleAddToCompare}
                  isActive={isInCompare(mappedProduct.id)}
                  activeColor="bg-blue-500"
                  ariaLabel="Toggle compare"
                  className="w-8 h-8 transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 delay-150 hover:scale-110"
                >
                  <Icon.PiArrowsCounterClockwise size={16} />
                </TooltipButton>
                <TooltipButton
                  label="Quick View"
                  onClick={handleQuickviewOpen}
                  ariaLabel="Quick view"
                  className="w-8 h-8 transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 delay-200 hover:scale-110"
                >
                  <Icon.PiEye size={16} />
                </TooltipButton>
              </div>

              {/* Product Images - Enhanced hover with zoom, fade, and shimmer loading */}
              <div className="product-img w-full h-full aspect-[3/4] overflow-hidden relative">
                {/* Shimmer loading effect */}
                {!imageLoaded && (
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-shimmer bg-[length:200%_100%]" />
                )}
                
                {activeColor ? (
                  <Image
                    src={
                      mappedProduct.variation?.find((item) => item.color === activeColor)?.image ||
                      mappedProduct.thumbImage?.[0] ||
                      '/images/placeholder-product.png'
                    }
                    width={500}
                    height={500}
                    alt={mappedProduct.name}
                    priority={true}
                    className={`w-full h-full object-cover transition-all duration-700 ease-out group-hover:scale-110 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={() => setImageLoaded(true)}
                  />
                ) : (
                  <>
                    {(mappedProduct.thumbImage || []).slice(0, 2).map((img, index) => (
                      <Image
                        key={index}
                        src={img || mappedProduct.thumbImage?.[0] || '/images/placeholder-product.png'}
                        width={500}
                        height={500}
                        priority={true}
                        alt={mappedProduct.name}
                        className={`w-full h-full object-cover transition-opacity duration-500 ${
                          index === 0 
                            ? 'relative z-10'
                            : 'absolute inset-0 z-20 opacity-0 group-hover:opacity-100'
                        }`}
                        onLoad={() => setImageLoaded(true)}
                      />
                    ))}
                  </>
                )}
                
                {/* Subtle gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-30" />
              </div>

              {/* Sale Marquee - Only show when there's an actual sale */}
              {(hasActiveSale && calculatedDiscount > 0) && (
                <div className="hidden md:block">
                  <Marquee className="banner-sale-auto bg-red-500 absolute bottom-0 left-0 w-full py-1.5">
                    <div className="caption2 font-semibold uppercase text-white px-2.5">
                      Hot Sale {calculatedDiscount}% OFF
                    </div>
                    <Icon.PiLightningFill className="text-yellow-300" />
                    <div className="caption2 font-semibold uppercase text-white px-2.5">
                      Hot Sale {calculatedDiscount}% OFF
                    </div>
                    <Icon.PiLightningFill className="text-yellow-300" />
                    <div className="caption2 font-semibold uppercase text-white px-2.5">
                      Hot Sale {calculatedDiscount}% OFF
                    </div>
                    <Icon.PiLightningFill className="text-yellow-300" />
                  </Marquee>
                </div>
              )}

              {/* Quick Shop Panel - Desktop only with hover */}
              <div className="hidden lg:block">
                {vendors.length > 0 && vendorSizes.length > 0 && (
                  <div
                    className={`quick-shop-block absolute left-4 right-4 bottom-4 bg-white p-4 rounded-xl shadow-2xl border border-gray-100 transition-all duration-300 z-30 ${
                      openQuickShop
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-4 pointer-events-none'
                    }`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Vendor Selection */}
                    {vendors.length > 1 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-gray-600 mb-2">Select Vendor</p>
                        <div className="flex flex-wrap gap-2">
                          {vendors.map((vendor) => {
                            const isActive = selectedVendor?.tenant._id === vendor.tenant._id;
                            return (
                              <button
                                key={vendor.tenant._id}
                                type="button"
                                onClick={() => setActiveVendor(vendor.tenant._id)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-all ${
                                  isActive
                                    ? 'border-orange-500 bg-orange-50 text-orange-700'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {vendor.tenant.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Size Selection */}
                    <div className="mb-3">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Select Size</p>
                      <div className="flex flex-wrap gap-2">
                        {vendorSizes.map((item, index) => (
                          <button
                            type="button"
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border-2 transition-all ${
                              activeSize === item.size
                                ? 'border-black bg-black text-white'
                                : item.stock === 0
                                  ? 'border-gray-200 text-gray-300 cursor-not-allowed line-through'
                                  : 'border-gray-200 hover:border-gray-400'
                            }`}
                            key={index}
                            disabled={item.stock === 0}
                            onClick={() => handleActiveSize(item.size)}
                          >
                            {item.displayName}
                            {item.stock <= 5 && item.stock > 0 && (
                              <span className="block text-[8px] text-red-500">{item.stock} left</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Add to Cart Button with ripple effect */}
                    <button
                      className={`w-full text-center rounded-full py-2.5 text-sm font-bold text-white transition-all duration-300 relative overflow-hidden ripple ${
                        activeSize
                          ? 'bg-gray-900 hover:bg-black shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                          : 'bg-gray-300 cursor-not-allowed'
                      } ${isAddingToCart ? 'animate-pulse' : ''}`}
                      onClick={(e) => {
                        if (activeSize) {
                          // Create ripple effect
                          const button = e.currentTarget;
                          const rect = button.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const y = e.clientY - rect.top;
                          
                          const ripple = document.createElement('span');
                          ripple.style.cssText = `
                            position: absolute;
                            background: rgba(255, 255, 255, 0.6);
                            border-radius: 50%;
                            transform: scale(0);
                            animation: ripple 0.6s linear;
                            left: ${x}px;
                            top: ${y}px;
                            width: 20px;
                            height: 20px;
                            margin-left: -10px;
                            margin-top: -10px;
                          `;
                          button.appendChild(ripple);
                          
                          setTimeout(() => ripple.remove(), 600);
                          
                          handleAddToCart();
                          setOpenQuickShop(false);
                        }
                      }}
                      disabled={!activeSize || isAddingToCart}
                    >
                      {isAddingToCart ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Adding...
                        </span>
                      ) : activeSize ? (
                        <span className="flex items-center justify-center gap-2">
                          <Icon.PiShoppingCart size={16} />
                          Add To Cart - {vendorSizes.find(s => s.size === activeSize)?.currencySymbol || '₦'}{vendorSizes.find(s => s.size === activeSize)?.price.toFixed(2)}
                        </span>
                      ) : (
                        'Select a Size'
                      )}
                    </button>
                  </div>
                )}

                {/* Quick Shop Toggle Button (shown on hover) - Desktop only with enhanced animation */}
                {vendors.length > 0 && vendorSizes.length > 0 && (
                  <button
                    className="absolute bottom-4 left-4 right-4 py-3 bg-white/95 backdrop-blur-sm text-gray-900 text-sm font-bold rounded-full shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-gray-900 hover:text-white hover:shadow-2xl transform translate-y-2 group-hover:translate-y-0 z-20 flex items-center justify-center gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenQuickShop(!openQuickShop);
                    }}
                  >
                    <Icon.PiShoppingCart size={18} />
                    Quick Shop
                  </button>
                )}
              </div>

              {/* Mobile Action Buttons - Bottom overlay with slide-up animation */}
              <div className="lg:hidden absolute bottom-3 left-3 right-3 flex items-center gap-2 z-20 transform translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <button
                  onClick={handleMobileAddToCart}
                  disabled={isAddingToCart}
                  className={`flex-1 py-2.5 bg-white/95 backdrop-blur-sm text-gray-900 text-sm font-bold rounded-xl shadow-xl active:scale-95 transition-all hover:bg-gray-900 hover:text-white flex items-center justify-center gap-1.5 ripple ${isAddingToCart ? 'opacity-75' : ''}`}
                >
                  {isAddingToCart ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <>
                      <Icon.PiShoppingCart size={16} />
                      <span>Add to Cart</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handleQuickviewOpen}
                  className="w-10 h-10 bg-white/95 backdrop-blur-sm rounded-xl shadow-xl flex items-center justify-center active:scale-95 transition-all hover:bg-gray-900 hover:text-white"
                  aria-label="Quick view"
                >
                  <Icon.PiEye size={18} />
                </button>
              </div>
            </div>

            {/* Product Information for Grid Type - Enhanced with animations */}
            <div className="product-infor mt-3 md:mt-4 flex-grow flex flex-col">
              {/* Sold/Available - Hidden on mobile, show on tablet+ with animation */}
              <div className="hidden sm:block product-sold sm:pb-4 pb-2">
                <div className="progress bg-gray-200 h-1.5 w-full rounded-full overflow-hidden relative">
                  <div
                    className="progress-sold bg-gradient-to-r from-red-400 to-red-600 absolute left-0 top-0 h-full transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, (mappedProduct.sold || 0) / (mappedProduct.quantity || 1) * 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 gap-y-1 flex-wrap mt-2">
                  <div className="text-xs font-medium">
                    <span className="text-gray-500">Sold: </span>
                    <span className="text-gray-900">{mappedProduct.sold}</span>
                  </div>
                  <div className="text-xs font-medium">
                    <span className="text-gray-500">Available: </span>
                    <span className="text-emerald-600 font-semibold">
                      {(mappedProduct.quantity ?? 0) - (mappedProduct.sold ?? 0)}
                    </span>
                  </div>
                </div>
              </div>

              <Link href={`/product/${mappedProduct.slug}`} className="block flex-grow">
                <h3 className="product-name text-sm md:text-base font-medium text-gray-900 transition-colors duration-300 hover:text-emerald-600 line-clamp-2 leading-tight group-hover:text-emerald-600">
                  {mappedProduct.name}
                </h3>
              </Link>

              {/* Enhanced Price Section */}
              <div className="flex items-center justify-between mt-1.5 md:mt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Discount Badge with pulse animation */}
                  {hasActiveSale && calculatedDiscount > 0 && (
                    <span className="px-2 py-0.5 bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold rounded-md shadow-sm">
                      -{calculatedDiscount}%
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="text-base md:text-lg font-bold text-gray-900 transition-transform duration-300 group-hover:scale-105">
                      {vendorSizes.find((s) => s.size === activeSize)?.currencySymbol || '₦'}
                      {(vendorSizes.find((s) => s.size === activeSize)?.price || mappedProduct.price).toFixed(2)}
                    </span>
                    {/* Original price with strikethrough animation */}
                    {hasActiveSale && (
                      <span className="text-xs text-gray-400 line-through decoration-gray-400 decoration-2">
                        {vendorSizes.find((s) => s.size === activeSize)?.currencySymbol || '₦'}
                        {mappedProduct.originPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Mobile wishlist button with animation */}
                <button
                  onClick={handleAddToWishlist}
                  className={`lg:hidden w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300 active:scale-90 ${
                    wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id)
                      ? 'text-red-500 bg-red-50'
                      : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                  }`}
                  aria-label="Toggle wishlist"
                >
                  {wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id) ? (
                    <Icon.PiHeartFill size={18} className="animate-pulse" />
                  ) : (
                    <Icon.PiHeart size={18} />
                  )}
                </button>
              </div>

              {/* Vendor Avatars - Desktop only */}
              {isBeverageProduct(data) && vendors.length > 1 && (
                <div className="vendor-avatars hidden lg:flex py-2 items-center gap-2 flex-wrap">
                  {vendors.slice(0, 3).map((vendor) => (
                    <VendorAvatar
                      key={vendor.tenant._id}
                      vendor={vendor}
                      isActive={selectedVendor?.tenant._id === vendor.tenant._id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveVendor(vendor.tenant._id);
                      }}
                      size="sm"
                    />
                  ))}
                  {vendors.length > 3 && (
                    <TooltipButton
                      label={`${vendors.length - 3} more vendors`}
                      onClick={() => {}}
                      ariaLabel="More vendors"
                      className="w-7 h-7"
                    >
                      <span className="text-xs font-bold">+{vendors.length - 3}</span>
                    </TooltipButton>
                  )}
                </div>
              )}

              {/* Mobile-only vendor count */}
              {isBeverageProduct(data) && vendors.length > 1 && (
                <div className="lg:hidden mt-1.5">
                  <span className="text-xs text-gray-500">
                    {vendors.length} {vendors.length === 1 ? 'seller' : 'sellers'} available
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // List Type Layout - Simplified for mobile
        <div ref={productCardRef} className="product-item list-type">
          <div className="product-main flex items-start sm:items-center gap-3 sm:gap-7">
            <div
              onClick={handleCardClick}
              className="product-thumb bg-gray-50 relative overflow-hidden rounded-xl sm:rounded-2xl block w-24 sm:w-auto flex-shrink-0 cursor-pointer"
            >
              {/* Badge */}
              {isBeverageProduct(data) && data.badge && data.badge.name && (
                <div
                  className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 rounded-full text-[10px] font-bold text-gray-50"
                  style={{ backgroundColor: data.badge?.color || '#10B981' }}
                >
                  {data.badge.name || data.badge.type?.toUpperCase()}
                </div>
              )}

              <div className="product-img w-24 sm:w-32 aspect-[3/4] sm:aspect-square rounded-xl sm:rounded-2xl overflow-hidden">
                <Image
                  src={mappedProduct.thumbImage[0] || '/images/placeholder-product.png'}
                  width={500}
                  height={500}
                  priority={true}
                  alt={mappedProduct.name}
                  className="w-full h-full object-cover duration-500 sm:duration-700 hover:scale-105"
                />
              </div>
            </div>

            <div className="flex-1 min-w-0 py-1">
              <Link href={`/product/${mappedProduct.slug}`}>
                <h3 className="product-name text-sm sm:text-base font-medium text-gray-900 duration-300 hover:text-green line-clamp-2">
                  {mappedProduct.name}
                </h3>
              </Link>

              <div className="flex items-center gap-2 mt-1.5 sm:mt-2">
                <span className="text-sm sm:text-base font-bold text-gray-900">
                  {vendorSizes.find((s) => s.size === activeSize)?.currencySymbol || '₦'}
                  {(vendorSizes.find((s) => s.size === activeSize)?.price || mappedProduct.price).toFixed(2)}
                </span>
                {percentSale > 0 && (
                  <span className="text-xs text-gray-400 line-through">
                    {vendorSizes.find((s) => s.size === activeSize)?.currencySymbol || '₦'}
                    {mappedProduct.originPrice.toFixed(2)}
                  </span>
                )}
              </div>

              {/* Vendor info - Simplified */}
              {isBeverageProduct(data) && vendors.length > 0 && (
                <div className="mt-1.5 sm:mt-2">
                  <span className="text-xs text-gray-500">
                    {vendors.length} {vendors.length === 1 ? 'seller' : 'sellers'}
                  </span>
                </div>
              )}

              <p className="hidden sm:block text-secondary desc mt-3 line-clamp-2 text-sm">
                {mappedProduct.description}
              </p>

              {/* Mobile action buttons */}
              <div className="flex items-center gap-2 mt-2 sm:mt-4">
                <button
                  className="flex-1 sm:flex-none py-2 px-4 bg-gray-900 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    openQuickview(mappedProduct);
                  }}
                >
                  <Icon.PiEye size={14} />
                  <span className="sm:hidden">View</span>
                  <span className="hidden sm:inline">Quick View</span>
                </button>
                <button
                  onClick={handleMobileAddToCart}
                  className="sm:hidden py-2 px-3 bg-gray-100 text-gray-900 rounded-lg active:bg-gray-200 transition-colors"
                >
                  <Icon.PiShoppingCart size={16} />
                </button>
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden sm:flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <TooltipButton
                  label={wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id)
                    ? 'Remove From Wishlist'
                    : 'Add To Wishlist'}
                  onClick={handleAddToWishlist}
                  isActive={wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id)}
                  activeColor="bg-red-500"
                  ariaLabel="Toggle wishlist"
                  className="w-10 h-10"
                >
                  {wishlistState.wishlistArray.some((item) => item.id === mappedProduct.id) ? (
                    <Icon.PiHeartFill size={18} className="text-white" />
                  ) : (
                    <Icon.PiHeart size={18} />
                  )}
                </TooltipButton>
                <TooltipButton
                  label="Compare Product"
                  onClick={handleAddToCompare}
                  isActive={isInCompare(mappedProduct.id)}
                  activeColor="bg-blue-500"
                  ariaLabel="Toggle compare"
                  className="w-10 h-10"
                >
                  <Icon.PiArrowsCounterClockwise size={18} />
                </TooltipButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductCard;
