'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import AddToCartButton from '@/components/UI/AddToCartButton';
import * as Icon from 'react-icons/pi';

const shimmerKeyframes = `
  @keyframes shimmer {
    0% { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(200%) skewX(-12deg); }
  }
  
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(244, 63, 94, 0.3); }
    50% { box-shadow: 0 0 40px rgba(244, 63, 94, 0.6); }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-5px); }
  }
  
  .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
  .animate-float { animation: float 3s ease-in-out infinite; }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = shimmerKeyframes;
  document.head.appendChild(style);
}

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
}

interface ProductSize {
  _id: string;
  size: string;
  volumeMl?: number;
  stock?: number;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
  };
}

interface AvailableAtEntry {
  _id?: string;
  tenant?: Tenant;
  sizes?: ProductSize[];
  isOnSale?: boolean;
  salePrice?: number;
  saleDiscountValue?: number;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
    compareAtPrice?: number;
    currencySymbol?: string;
  };
  totalStock?: number;
}

interface Sale {
  _id: string;
  name: string;
  description: string;
  type: string;
  discountType: string;
  discountValue: number;
  bannerImage?: {
    url: string;
    alt?: string;
  };
  startDate: string;
  endDate: string;
}

interface SaleProduct {
  _id: string;
  name: string;
  slug: string;
  primaryImage?: {
    url: string;
  };
  images?: Array<{ url: string }>;
  priceRange?: {
    min: number;
    max: number;
    display?: string;
  };
  averageRating?: number;
  reviewCount?: number;
  availableAt?: AvailableAtEntry[];
  totalSold?: number;
}

interface ProductCardProps {
  product: SaleProduct;
  onAddToCart: (product: SaleProduct, size?: ProductSize) => void;
  onRemoveFromCart?: (product: SaleProduct) => void;
  isAdding: string | null;
}

const SaleBadge: React.FC<{ discountType: string; discountValue: number }> = ({ discountType, discountValue }) => {
  const getStyle = () => {
    switch (discountType) {
      case 'percentage':
        return 'bg-gradient-to-r from-rose-500 to-pink-500';
      case 'fixed':
        return 'bg-gradient-to-r from-orange-500 to-amber-500';
      case 'bogo':
        return 'bg-gradient-to-r from-emerald-500 to-teal-500';
      case 'flash_sale':
        return 'bg-gradient-to-r from-rose-500 to-orange-500';
      default:
        return 'bg-gradient-to-r from-rose-500 to-pink-500';
    }
  };

  const getContent = () => {
    switch (discountType) {
      case 'percentage':
        return `-${discountValue}%`;
      case 'fixed':
        return `₦${discountValue.toLocaleString()} OFF`;
      case 'bogo':
        return 'BOGO';
      default:
        return `${discountValue}% OFF`;
    }
  };

  return (
    <motion.div
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      className={`${getStyle()} text-white px-4 py-1.5 rounded-xl font-black text-sm shadow-lg inline-flex items-center gap-1`}
    >
      <Icon.PiLightningFill size={14} className="animate-pulse" />
      {getContent()}
    </motion.div>
  );
};

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, onRemoveFromCart, isAdding }) => {
  const { cartState } = useCart();
  const mainImage = product.primaryImage?.url || product.images?.[0]?.url || '/images/placeholder-product.png';
  const availableAt = product.availableAt?.[0];
  const sizes = availableAt?.sizes || [];
  const pricing = sizes[0]?.pricing || availableAt?.pricing;
  
  const originalPrice = pricing?.websitePrice || product.priceRange?.min || 0;
  const salePrice = availableAt?.salePrice;
  const currencySymbol = '₦';
  
  const hasDiscount = salePrice && salePrice < originalPrice;
  const discountPercent = hasDiscount ? Math.round((1 - salePrice / originalPrice) * 100) : 0;
  const isAddingToCart = isAdding === product._id;

  // Get all unique sizes from availableAt
  const allSizes = useMemo(() => {
    const sizeMap = new Map<string, ProductSize>();
    product.availableAt?.forEach(at => {
      at.sizes?.forEach(size => {
        if (!sizeMap.has(size._id)) {
          sizeMap.set(size._id, size);
        }
      });
    });
    return Array.from(sizeMap.values());
  }, [product.availableAt]);

  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(allSizes[0] || null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Check if product is in cart
  const cartItem = useMemo(() => {
    return cartState.cartArray.find(item => {
      const itemSize = item.selectedSize || 'default';
      const itemVendor = item.selectedVendor || 'default';
      const productId = item._id || item.id;
      return productId === product._id && 
             itemSize === (selectedSize?.size || 'default') &&
             itemVendor === (availableAt?.tenant?.name || 'default');
    });
  }, [cartState.cartArray, product._id, selectedSize, availableAt]);

  const inCart = !!cartItem;
  const cartQuantity = cartItem?.quantity || 0;

  const tenantLogo = availableAt?.tenant?.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative bg-white rounded-3xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.06)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] transition-all duration-500"
    >
      {/* Gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-br from-rose-50/30 via-transparent to-amber-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Image Section */}
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        <Link href={`/product/${product.slug}`}>
          <div className="relative w-full h-full">
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-200 animate-pulse" />
            )}
            <img
              src={mainImage}
              alt={product.name}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out ${isHovered ? 'scale-110' : 'scale-100'}`}
              onLoad={() => setImageLoaded(true)}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent) {
                  const fallback = parent.querySelector('.image-fallback') as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }
              }}
            />
            <div className="image-fallback absolute inset-0 hidden items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
              <span className="text-4xl opacity-50">🍹</span>
            </div>
          </div>
        </Link>
        
        {/* Discount Badge */}
        {hasDiscount && (
          <motion.div
            initial={{ opacity: 0, x: -20, rotate: -5 }}
            animate={{ opacity: 1, x: 0, rotate: 0 }}
            className="absolute top-3 left-3 z-10"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-rose-500 blur-md opacity-40 animate-pulse rounded-xl" />
              <div className="relative bg-gradient-to-r from-rose-500 to-rose-600 text-white font-black text-sm px-3 py-1.5 rounded-xl shadow-lg">
                -{discountPercent}%
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Flash Sale Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-3 right-3 z-10"
        >
          <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-rose-100">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Icon.PiLightningFill size={14} className="text-amber-500" />
            </motion.div>
            <span className="text-xs font-bold text-gray-800">FLASH</span>
          </div>
        </motion.div>

        {/* Tenant Badge */}
        {tenantLogo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute bottom-3 left-3 z-10"
          >
            <div className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg shadow-md border border-gray-100">
              <span className="text-[10px] font-medium text-gray-600 truncate max-w-[80px] block">
                {tenantLogo}
              </span>
            </div>
          </motion.div>
        )}
        
        {/* In Cart Indicator */}
        <AnimatePresence>
          {inCart && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute bottom-3 right-3 z-10"
            >
              <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                <Icon.PiCheckCircleFill size={14} />
                {cartQuantity} in cart
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content Section */}
      <div className="relative p-4">
        {/* Product Name */}
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-rose-600 transition-colors duration-300 min-h-[2.5rem]">
            {product.name}
          </h3>
        </Link>
        
        {/* Rating */}
        {product.averageRating && product.averageRating > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <div className="flex items-center">
              {Array.from({ length: 5 }).map((_, i) => (
                <Icon.PiStarFill
                  key={i}
                  size={12}
                  className={i < Math.floor(product.averageRating || 0) ? 'text-amber-400' : 'text-gray-200'}
                />
              ))}
            </div>
            <span className="text-xs text-gray-500 font-medium">
              {product.averageRating.toFixed(1)} ({product.reviewCount || 0})
            </span>
          </div>
        )}

        {/* Size Selector */}
        {allSizes.length > 1 && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1">
              {allSizes.slice(0, 4).map((size) => (
                <button
                  key={size._id}
                  onClick={() => setSelectedSize(size)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                    selectedSize?._id === size._id
                      ? 'bg-rose-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {size.size}
                </button>
              ))}
              {allSizes.length > 4 && (
                <span className="px-2 py-0.5 text-[10px] text-gray-400">
                  +{allSizes.length - 4}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Price Section */}
        <div className="mt-3 flex items-end gap-2">
          {hasDiscount ? (
            <>
              <div className="flex flex-col">
                <span className="text-xl font-black text-gray-900">
                  {currencySymbol}{salePrice?.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  {currencySymbol}{originalPrice.toLocaleString()}
                </span>
              </div>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 mb-0.5"
              >
                Save {discountPercent}%
              </motion.span>
            </>
          ) : (
            <span className="text-xl font-black text-gray-900">
              {currencySymbol}{originalPrice.toLocaleString()}
            </span>
          )}
        </div>

        {/* Add to Cart Button */}
        <AddToCartButton
          onClick={() => onAddToCart(product, selectedSize || undefined)}
          onRemove={() => onRemoveFromCart && onRemoveFromCart(product)}
          isAdding={isAddingToCart}
          inCart={inCart}
          cartQuantity={cartQuantity}
          variant="full"
          colorScheme="emerald"
          size="md"
          className="mt-4"
          showRemove={true}
        />
      </div>
    </motion.div>
  );
};

const SaleCountdown = ({ endDate }: { endDate: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const difference = end - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
        setIsUrgent(difference < 3600000); // Less than 1 hour
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  const timeUnits = [
    { value: timeLeft.days, label: 'Days', bg: 'bg-rose-100', text: 'text-rose-600' },
    { value: timeLeft.hours, label: 'Hours', bg: 'bg-orange-100', text: 'text-orange-600' },
    { value: timeLeft.minutes, label: 'Mins', bg: 'bg-amber-100', text: 'text-amber-600' },
    { value: timeLeft.seconds, label: 'Secs', bg: 'bg-yellow-100', text: 'text-yellow-600' },
  ];

  return (
    <div className="flex items-center gap-2">
      {timeUnits.map((item) => (
        <div key={item.label} className="flex flex-col items-center">
          <div className={`${item.bg} ${item.text} rounded-xl px-3 py-2 min-w-[52px] text-center font-bold text-lg ${isUrgent ? 'animate-pulse' : ''}`}>
            {String(item.value).padStart(2, '0')}
          </div>
          <span className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-wide">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const FlashSale = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [saleProducts, setSaleProducts] = useState<SaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [swiper, setSwiper] = useState<SwiperType | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { addToCart, removeFromCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isProductInWishlist = useCallback((product: SaleProduct) => {
    return wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
  }, [wishlistState.wishlistArray]);

  const handleAddToCart = async (product: SaleProduct, selectedSize?: ProductSize) => {
    setAddingToCart(product._id);
    try {
      const availableAt = product.availableAt?.[0];
      const size = selectedSize || availableAt?.sizes?.[0];
      const sizePricing = size?.pricing || availableAt?.pricing;
      const tenantName = availableAt?.tenant?.name || '';
      const tenantId = availableAt?.tenant?._id || '';
      
      const cartItemId = `${product._id}-${size?.size || 'default'}-${tenantName || 'default'}-default`;
      const existingItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
      const wasAlreadyInCart = !!existingItem;
      
      const productData = {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: availableAt?.salePrice || sizePricing?.websitePrice || product.priceRange?.min || 0,
        originPrice: sizePricing?.originalWebsitePrice || product.priceRange?.max || 0,
        thumbImage: [product.primaryImage?.url || product.images?.[0]?.url || '/images/placeholder-product.png'],
      };

      await addToCart(
        { ...productData, id: product._id } as any,
        size?.size || 'Default',
        '',
        tenantName,
        tenantId,
        1,
        size?._id || '',
        availableAt?._id || ''
      );
      
      await new Promise(resolve => setTimeout(resolve, 300));
      showToast(wasAlreadyInCart ? `Quantity increased to ${(existingItem?.quantity || 0) + 1}!` : `${product.name} added to cart!`, 'success');
      openModalCart();
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setAddingToCart(null);
    }
  };

  const handleRemoveFromCart = (product: SaleProduct) => {
    try {
      const cartItem = cartState.cartArray.find(item => item.cartItemId.startsWith(product._id));
      
      if (cartItem) {
        removeFromCart(cartItem.cartItemId);
        showToast(`${product.name} removed from cart`, 'success');
      }
    } catch {
      showToast('Failed to remove from cart', 'error');
    }
  };

  const handleWishlistToggle = (product: SaleProduct) => {
    setWishlistAdding(product._id);
    try {
      const inWishlist = isProductInWishlist(product);
      
      const wishlistItem = {
        id: product._id,
        _id: product._id,
        name: product.name,
        slug: product.slug,
        type: 'beverage',
        price: product.availableAt?.[0]?.salePrice || product.priceRange?.min || 0,
        originPrice: product.availableAt?.[0]?.pricing?.originalWebsitePrice || product.priceRange?.max || 0,
        primaryImage: product.primaryImage || { url: product.images?.[0]?.url || '/images/placeholder-product.png', alt: product.name },
        images: product.images || [],
        thumbImage: [product.primaryImage?.url || product.images?.[0]?.url || '/images/placeholder-product.png'],
        sale: true,
        createdAt: new Date().toISOString(),
      };

      if (inWishlist) {
        removeFromWishlist(product._id);
        showToast('Removed from wishlist', 'success');
      } else {
        addToWishlist(wishlistItem);
        showToast('Added to wishlist!', 'success');
        setTimeout(() => openModalWishlist(), 300);
      }
    } catch {
      showToast('Failed to update wishlist', 'error');
    } finally {
      setWishlistAdding(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const [salesRes, productsRes] = await Promise.all([
          fetch(`${API_URL}/api/sales/active?limit=5`),
          fetch(`${API_URL}/api/products?onSale=true&limit=8`),
        ]);
        
        const salesData = await salesRes.json();
        const productsData = await productsRes.json();
        
        if (salesData.success) setSales(salesData.data.sales || []);
        if (productsData.success) setSaleProducts(productsData.data.products || []);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (sales.length <= 1) return;
    const interval = setInterval(() => {
      const next = (activeIndex + 1) % sales.length;
      setActiveIndex(next);
      swiper?.slideTo(next);
    }, 7000);
    return () => clearInterval(interval);
  }, [sales.length, activeIndex, swiper]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-gray-100 rounded-3xl h-[500px] animate-pulse" />
      </div>
    );
  }

  if (sales.length === 0 && saleProducts.length === 0) {
    return null;
  }

  const currentSale = sales[activeIndex] || sales[0];

  return (
    <div className="bg-gradient-to-b from-white to-rose-50/30 py-14 sm:py-20">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-2.5 ${
              toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? <Icon.PiCheckCircle size={20} /> : <Icon.PiWarning size={20} />}
            <span className="font-medium text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4 group">
            <div className="w-14 h-14 bg-gradient-to-br from-rose-500 via-pink-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200 relative overflow-hidden group-hover:shadow-xl group-hover:shadow-rose-300/50 transition-all duration-500 group-hover:scale-105">
              <Icon.PiLightningFill size={28} className="text-white relative z-10 drop-shadow-lg" />
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 to-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
            
            <div>
              <h2 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-gray-900 via-rose-600 to-orange-600 bg-clip-text text-transparent">
                Flash Sale
              </h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Limited time offers - Grab them quick! ⚡
              </p>
            </div>
          </div>
          
          <Link 
            href="/shop?sale=true" 
            className="hidden sm:flex items-center gap-2 text-gray-600 hover:text-rose-600 transition-colors text-sm font-semibold group"
          >
            View All Deals
            <Icon.PiArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Sale Banners */}
        {sales.length > 0 && (
          <div className="mb-12">
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              onSwiper={setSwiper}
              onSlideChange={(swiper) => setActiveIndex(swiper.activeIndex)}
              autoplay={{ delay: 7000, disableOnInteraction: false }}
              loop={sales.length > 1}
              className="rounded-3xl overflow-hidden"
            >
              {sales.map((sale) => (
                <SwiperSlide key={sale._id}>
                  <div className="relative min-h-[300px] sm:min-h-[350px] flex items-center">
                    {sale.bannerImage ? (
                      <>
                        <div className="absolute inset-0">
                          <Image
                            src={sale.bannerImage.url}
                            alt={sale.bannerImage.alt || sale.name}
                            fill
                            className="object-cover"
                            priority
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-white/50" />
                        </div>
                        <div className="relative z-10 container mx-auto px-6 sm:px-12 py-10 w-full">
                          <div className="max-w-xl">
                            <SaleBadge discountType={sale.discountType} discountValue={sale.discountValue} />
                            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mt-4 leading-tight">
                              {sale.name}
                            </h3>
                            {sale.description && (
                              <p className="text-gray-600 mt-3 text-base sm:text-lg line-clamp-2">
                                {sale.description}
                              </p>
                            )}
                            <div className="mt-6">
                              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Ends In</p>
                              <SaleCountdown endDate={sale.endDate} />
                            </div>
                            <Link
                              href="/shop"
                              className="inline-flex items-center gap-2 mt-6 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                            >
                              Shop Now <Icon.PiArrowRight size={20} />
                            </Link>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="relative z-10 container mx-auto px-6 sm:px-12 py-10 w-full">
                        <div className="max-w-xl">
                          <SaleBadge discountType={sale.discountType} discountValue={sale.discountValue} />
                          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mt-4 leading-tight">
                            {sale.name}
                          </h3>
                          {sale.description && (
                            <p className="text-gray-600 mt-3 text-base sm:text-lg line-clamp-2">
                              {sale.description}
                            </p>
                          )}
                          <div className="mt-6">
                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Ends In</p>
                            <SaleCountdown endDate={sale.endDate} />
                          </div>
                          <Link
                            href="/shop"
                            className="inline-flex items-center gap-2 mt-6 bg-gray-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
                          >
                            Shop Now <Icon.PiArrowRight size={20} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {sales.length > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                {sales.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setActiveIndex(idx); swiper?.slideTo(idx); }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === activeIndex 
                        ? 'w-8 bg-gradient-to-r from-rose-500 to-orange-500' 
                        : 'w-2 bg-gray-300 hover:bg-rose-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sale Products */}
        {saleProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Icon.PiTagDuotone size={24} className="text-rose-500" />
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Products on Sale</h3>
                <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  {saleProducts.length} Items
                </span>
              </div>
              
              <Link 
                href="/shop?sale=true"
                className="sm:hidden flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm font-medium"
              >
                View All <Icon.PiArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {saleProducts.slice(0, 8).map((product) => (
                <motion.div
                  key={product._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative"
                >
                  <ProductCard
                    product={product}
                    onAddToCart={handleAddToCart}
                    onRemoveFromCart={handleRemoveFromCart}
                    isAdding={addingToCart}
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleWishlistToggle(product)}
                    disabled={wishlistAdding === product._id}
                    className={`absolute top-16 right-3 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all ${
                      wishlistAdding === product._id
                        ? 'bg-gray-400'
                        : isProductInWishlist(product)
                          ? 'bg-red-500 text-white'
                          : 'bg-white text-gray-500 hover:bg-red-50 hover:text-red-500'
                    }`}
                  >
                    {wishlistAdding === product._id ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                        <Icon.PiSpinner size={16} className="text-white" />
                      </motion.div>
                    ) : isProductInWishlist(product) ? (
                      <Icon.PiHeartFill size={16} />
                    ) : (
                      <Icon.PiHeart size={16} />
                    )}
                  </motion.button>
                </motion.div>
              ))}
            </div>

            {saleProducts.length > 8 && (
              <div className="text-center mt-10">
                <Link
                  href="/shop?sale=true"
                  className="inline-flex items-center gap-2 border-2 border-gray-200 text-gray-700 px-8 py-3 rounded-xl font-semibold hover:border-gray-900 hover:text-gray-900 transition-all duration-300"
                >
                  View All {saleProducts.length} Sale Products
                  <Icon.PiArrowRight size={20} />
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Stats Grid */}
        {saleProducts.length > 0 && (
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 text-center border border-gray-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="text-3xl sm:text-4xl font-black text-gray-900">{saleProducts.length}+</div>
              <div className="text-gray-500 text-sm mt-1">Products</div>
              <Icon.PiPackage size={20} className="mx-auto mt-2 text-gray-400" />
            </div>
            
            <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl p-5 text-center border border-rose-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="text-3xl sm:text-4xl font-black text-rose-500">
                {Math.max(...saleProducts.map(p => p.availableAt?.[0]?.saleDiscountValue || 0))}%
              </div>
              <div className="text-rose-600 text-sm mt-1">Max Discount</div>
              <Icon.PiPercent size={20} className="mx-auto mt-2 text-rose-400" />
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-5 text-center border border-emerald-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="text-3xl sm:text-4xl font-black text-emerald-600">
                ₦{Math.min(...saleProducts.map(p => p.priceRange?.min || 0)).toLocaleString()}
              </div>
              <div className="text-emerald-600 text-sm mt-1">Starting From</div>
              <Icon.PiCurrencyNgn size={20} className="mx-auto mt-2 text-emerald-400" />
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-5 text-center border border-orange-200 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
              <div className="text-3xl sm:text-4xl font-black text-orange-500 flex items-center justify-center gap-1">
                24<span className="text-lg animate-pulse">h</span>
              </div>
              <div className="text-orange-600 text-sm mt-1">Ending Soon</div>
              <Icon.PiClock size={20} className="mx-auto mt-2 text-orange-400 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlashSale;
