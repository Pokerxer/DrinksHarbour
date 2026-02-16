'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import * as Icon from 'react-icons/pi';

const shimmerKeyframes = `
  @keyframes shimmer {
    0% { transform: translateX(-100%) skewX(-12deg); }
    100% { transform: translateX(200%) skewX(-12deg); }
  }
  
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }
  
  @keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(244, 63, 94, 0.3); }
    50% { box-shadow: 0 0 40px rgba(244, 63, 94, 0.6); }
  }
  
  .animate-shimmer { animation: shimmer 2s ease-in-out infinite; }
  .animate-float { animation: float 3s ease-in-out infinite; }
  .animate-glow { animation: glow 2s ease-in-out infinite; }
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
}

interface ProductSize {
  _id: string;
  size: string;
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
}

interface ProductCardProps {
  product: SaleProduct;
  onAddToCart: (product: SaleProduct) => void;
  isAdding: string | null;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, isAdding }) => {
  const mainImage = product.primaryImage?.url || product.images?.[0]?.url || '/images/placeholder-product.png';
  const availableAt = product.availableAt?.[0];
  const sizeData = availableAt?.sizes?.[0];
  const pricing = sizeData?.pricing || availableAt?.pricing;
  
  const originalPrice = pricing?.websitePrice || product.priceRange?.min || 0;
  const salePrice = availableAt?.salePrice;
  const currencySymbol = pricing?.currencySymbol || '₦';
  
  const hasDiscount = salePrice && salePrice < originalPrice;
  const discountPercent = hasDiscount ? Math.round((1 - salePrice / originalPrice) * 100) : 0;
  const isAddingToCart = isAdding === product._id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Link href={`/product/${product.slug}`}>
          <motion.div
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.4 }}
            className="relative w-full h-full"
          >
            <Image
              src={mainImage}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
          </motion.div>
        </Link>
        
        {hasDiscount && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute top-3 left-3 bg-rose-500 text-white text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm"
          >
            {discountPercent}% OFF
          </motion.div>
        )}
        
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-medium px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm"
        >
          <Icon.PiLightning size={12} className="text-amber-500" />
          SALE
        </motion.div>
      </div>

      <div className="p-4">
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2 hover:text-gray-700 transition-colors">
            {product.name}
          </h3>
        </Link>
        
        {product.averageRating && product.averageRating > 0 && (
          <div className="flex items-center gap-1 mt-2">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 200, damping: 15 }}
                >
                  <Icon.PiStarFill
                    size={12}
                    className={i < Math.floor(product.averageRating) ? 'text-yellow-400' : 'text-gray-200'}
                  />
                </motion.div>
              ))}
            </div>
            <span className="text-xs text-gray-500">
              ({product.reviewCount || 0})
            </span>
          </div>
        )}
        
        <div className="mt-3 flex items-center gap-2">
          {hasDiscount ? (
            <>
              <span className="text-lg font-bold text-gray-900">
                {currencySymbol}{salePrice?.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400 line-through">
                {currencySymbol}{originalPrice?.toLocaleString()}
              </span>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"
              >
                Save {discountPercent}%
              </motion.span>
            </>
          ) : (
            <span className="text-lg font-bold text-gray-900">
              {currencySymbol}{originalPrice?.toLocaleString()}
            </span>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onAddToCart(product)}
          disabled={isAddingToCart}
          className={`w-full mt-4 py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            isAddingToCart 
              ? 'bg-green-500 text-white'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}
        >
          {isAddingToCart ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
              <Icon.PiSpinner size={16} />
            </motion.div>
          ) : (
            <>
              <Icon.PiShoppingCart size={16} />
              Add to Cart
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
};

const SaleCountdown = ({ endDate }: { endDate: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [previousTime, setPreviousTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const difference = end - now;

      if (difference > 0) {
        const newTime = {
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        };

        setTimeLeft((prevTime) => {
          setPreviousTime(prevTime);
          return newTime;
        });

        const totalHours = newTime.days * 24 + newTime.hours;
        setIsUrgent(totalHours < 1);
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  const timeUnits = [
    { 
      value: timeLeft.days, 
      prevValue: previousTime.days,
      label: 'Days', 
      bg: isUrgent ? 'bg-red-100' : 'bg-rose-100', 
      text: isUrgent ? 'text-red-600' : 'text-rose-600', 
      border: isUrgent ? 'border-red-200' : 'border-rose-200',
      accent: isUrgent ? 'bg-red-500' : 'bg-rose-500'
    },
    { 
      value: timeLeft.hours, 
      prevValue: previousTime.hours,
      label: 'Hours', 
      bg: isUrgent ? 'bg-red-100' : 'bg-orange-100', 
      text: isUrgent ? 'text-red-600' : 'text-orange-600', 
      border: isUrgent ? 'border-red-200' : 'border-orange-200',
      accent: isUrgent ? 'bg-red-500' : 'bg-orange-500'
    },
    { 
      value: timeLeft.minutes, 
      prevValue: previousTime.minutes,
      label: 'Mins', 
      bg: isUrgent ? 'bg-red-100' : 'bg-amber-100', 
      text: isUrgent ? 'text-red-600' : 'text-amber-600', 
      border: isUrgent ? 'border-red-200' : 'border-amber-200',
      accent: isUrgent ? 'bg-red-500' : 'bg-amber-500'
    },
    { 
      value: timeLeft.seconds, 
      prevValue: previousTime.seconds,
      label: 'Secs', 
      bg: isUrgent ? 'bg-red-100' : 'bg-yellow-100', 
      text: isUrgent ? 'text-red-600' : 'text-yellow-600', 
      border: isUrgent ? 'border-red-200' : 'border-yellow-200',
      accent: isUrgent ? 'bg-red-500' : 'bg-yellow-500'
    },
  ];

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {timeUnits.map((item, idx) => (
        <div key={item.label} className="flex flex-col items-center group">
          <div className={`${item.bg} ${item.text} rounded-xl px-3 py-2 sm:px-4 sm:py-3 min-w-[48px] sm:min-w-[60px] text-center border ${item.border} transition-all duration-500 transform hover:scale-110 hover:shadow-lg relative overflow-hidden ${isUrgent ? 'animate-pulse shadow-lg' : ''}`}>
            <div className={`absolute inset-0 ${item.accent} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
            <span 
              key={item.value} 
              className={`font-bold text-lg sm:text-2xl block font-mono transition-all duration-300 ${
                item.value !== item.prevValue ? 'animate-bounce' : ''
              }`}
            >
              {String(item.value).padStart(2, '0')}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shimmer opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          <span className={`text-gray-400 text-[10px] sm:text-xs mt-1.5 font-medium uppercase tracking-wide transition-colors duration-300 group-hover:text-gray-600 ${isUrgent ? 'text-red-400' : ''}`}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
};

const SaleBadge = ({ discountType, discountValue }: { discountType: string; discountValue: number }) => {
  const badgeStyles: Record<string, { bg: string; text: string }> = {
    percentage: { bg: 'bg-rose-500', text: 'text-white' },
    fixed: { bg: 'bg-orange-500', text: 'text-white' },
    bogo: { bg: 'bg-emerald-500', text: 'text-white' },
    bundle: { bg: 'bg-violet-500', text: 'text-white' },
    flash_sale: { bg: 'bg-gradient-to-r from-rose-500 to-orange-500', text: 'text-white' },
  };

  const style = badgeStyles[discountType] || badgeStyles.percentage;

  let content = '';
  switch (discountType) {
    case 'percentage':
      content = `-${discountValue}%`;
      break;
    case 'fixed':
      content = `₦${discountValue.toLocaleString()}`;
      break;
    case 'bogo':
      content = 'BOGO';
      break;
    default:
      content = `${discountValue}% OFF`;
  }

  return (
    <div className={`${style.bg} ${style.text} px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl font-bold text-base sm:text-lg shadow-sm inline-flex items-center gap-1`}>
      {discountType === 'bogo' && <Icon.PiGift size={16} />}
      {content}
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

  const { addToCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isProductInCart = useCallback((product: SaleProduct) => {
    const availableAt = product.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = availableAt?.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    return cartState.cartArray.some(item => item.cartItemId === cartItemId);
  }, [cartState.cartArray]);

  const getCartQuantity = useCallback((product: SaleProduct) => {
    const availableAt = product.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = availableAt?.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return cartItem?.quantity || 0;
  }, [cartState.cartArray]);

  const isProductInWishlist = useCallback((product: SaleProduct) => {
    return wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
  }, [wishlistState.wishlistArray]);

  const handleAddToCart = async (product: SaleProduct) => {
    setAddingToCart(product._id);
    try {
      const availableAt = product.availableAt?.[0];
      const sizeData = availableAt?.sizes?.[0];
      const pricing = sizeData?.pricing || availableAt?.pricing;
      const size = sizeData?.size || 'Default';
      const tenantName = availableAt?.tenant?.name || '';
      const tenantId = availableAt?.tenant?._id || '';
      const cartItemId = `${product._id}-${size}-${tenantName || 'default'}-default`;
      
      const existingItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
      const wasAlreadyInCart = !!existingItem;
      
      const productData = {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: availableAt?.salePrice || pricing?.websitePrice || product.priceRange?.min || 0,
        originPrice: pricing?.originalWebsitePrice || product.priceRange?.max || 0,
        thumbImage: [product.primaryImage?.url || product.images?.[0]?.url || '/images/placeholder-product.png'],
      };

      await addToCart(
        { ...productData, id: product._id } as any,
        size,
        '',
        tenantName,
        tenantId,
        1,
        sizeData?._id || '',
        availableAt?._id || ''
      );
      
      await new Promise(resolve => setTimeout(resolve, 400));
      showToast(wasAlreadyInCart ? `Quantity increased to ${(existingItem?.quantity || 0) + 1}!` : `${product.name} added to cart!`, 'success');
      openModalCart();
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setAddingToCart(null);
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
        const [salesRes, productsRes] = await Promise.all([
          fetch('http://localhost:5001/api/sales/active?limit=5'),
          fetch('http://localhost:5001/api/products?onSale=true&limit=8'),
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
    <div className="bg-white py-14 sm:py-20">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-2.5 ${
              toast.type === 'success' ? 'bg-rose-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {toast.type === 'success' ? <Icon.PiCheckCircle size={20} /> : <Icon.PiWarning size={20} />}
            <span className="font-medium text-sm">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-1 hover:opacity-70">
              <Icon.PiX size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-4 group">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-rose-500 via-pink-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200 relative overflow-hidden group-hover:shadow-xl group-hover:shadow-rose-300/50 transition-all duration-500 group-hover:scale-110">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 to-red-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Icon.PiLightningFill size={26} className="text-white relative z-10 transform group-hover:rotate-12 group-hover:scale-110 transition-all duration-300 drop-shadow-lg" />
              <div className="absolute inset-0 rounded-2xl border-2 border-yellow-400/50 animate-ping opacity-0 group-hover:opacity-75" />
              <div className="absolute inset-0 rounded-2xl border border-white/30 animate-pulse" />
            </div>
            
            <div className="transform group-hover:translate-x-2 transition-transform duration-300">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 via-rose-600 to-orange-600 bg-clip-text text-transparent group-hover:from-rose-600 group-hover:via-pink-600 group-hover:to-orange-500 transition-all duration-500">
                Flash Sale
              </h2>
              <p className="text-gray-500 text-sm mt-1 group-hover:text-gray-600 transition-colors duration-300">
                Limited time offers - Grab them quick!
                <span className="inline-block ml-2 group-hover:animate-bounce">⚡</span>
              </p>
            </div>
          </div>
          
          <Link 
            href="/shop?sale=true" 
            className="hidden sm:flex items-center gap-2 text-gray-600 hover:text-rose-600 transition-all duration-300 text-sm font-medium group relative overflow-hidden px-4 py-2 rounded-xl hover:bg-rose-50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-rose-50 to-pink-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <span className="relative z-10 group-hover:font-semibold transition-all duration-300">View All Deals</span>
            <Icon.PiArrowRight size={18} className="relative z-10 group-hover:translate-x-1 group-hover:scale-110 transition-all duration-300" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -skew-x-12 opacity-0 group-hover:opacity-100 animate-shimmer transition-opacity duration-500" />
          </Link>
        </div>

        {sales.length > 0 && (
          <div className="mb-16">
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
                  <div className="relative min-h-[320px] sm:min-h-[380px] lg:min-h-[420px] flex items-center">
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
                          <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-white/40" />
                        </div>
                        <div className="relative z-10 container mx-auto px-6 sm:px-12 py-12">
                          <div className="max-w-xl">
                            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-4 shadow-lg shadow-rose-200">
                              <Icon.PiLightningFill size={14} className="animate-pulse" />
                              FLASH SALE
                            </div>
                            
                            <SaleBadge discountType={sale.discountType} discountValue={sale.discountValue} />
                            
                            <h3 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mt-6 leading-tight">
                              {sale.name}
                            </h3>
                            
                            {sale.description && (
                              <p className="text-gray-600 mt-4 text-base sm:text-lg line-clamp-2">
                                {sale.description}
                              </p>
                            )}
                            
                            <div className="mt-8">
                              <p className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-3">Ends In</p>
                              <SaleCountdown endDate={sale.endDate} />
                            </div>
                            
                            <Link
                              href="/shop"
                              className="inline-flex items-center gap-2 mt-8 bg-gray-900 text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                            >
                              Shop Now
                              <Icon.PiArrowRight size={20} />
                            </Link>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="relative z-10 container mx-auto px-6 sm:px-12 py-12 w-full">
                        <div className="max-w-xl">
                          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-rose-500 to-orange-500 text-white px-4 py-2 rounded-full text-sm font-bold mb-4 shadow-lg shadow-rose-200">
                            <Icon.PiLightningFill size={14} className="animate-pulse" />
                            FLASH SALE
                          </div>
                          
                          <SaleBadge discountType={sale.discountType} discountValue={sale.discountValue} />
                          
                          <h3 className="text-2xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mt-6 leading-tight">
                            {sale.name}
                          </h3>
                          
                          {sale.description && (
                            <p className="text-gray-600 mt-4 text-base sm:text-lg line-clamp-2">
                              {sale.description}
                            </p>
                          )}
                          
                          <div className="mt-8">
                            <p className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-3">Ends In</p>
                            <SaleCountdown endDate={sale.endDate} />
                          </div>
                          
                          <Link
                            href="/shop"
                            className="inline-flex items-center gap-2 mt-8 bg-gray-900 text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                          >
                            Shop Now
                            <Icon.PiArrowRight size={20} />
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>

            {sales.length > 1 && (
              <div className="flex justify-center gap-3 mt-6">
                {sales.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveIndex(idx);
                      swiper?.slideTo(idx);
                    }}
                    className={`relative transition-all duration-300 group ${
                      idx === activeIndex 
                        ? 'w-8 h-2.5' 
                        : 'w-2.5 h-2.5 hover:w-4'
                    }`}
                  >
                    <div className={`w-full h-full rounded-full transition-all duration-300 ${
                      idx === activeIndex 
                        ? 'bg-gradient-to-r from-rose-500 to-orange-500 shadow-lg' 
                        : 'bg-gray-300 group-hover:bg-rose-400'
                    }`} />
                    {idx === activeIndex && (
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 opacity-50 animate-ping" />
                    )}
                    <div className="absolute inset-0 rounded-full bg-rose-500 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {saleProducts.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Icon.PiTagDuotone size={24} className="text-rose-500" />
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Products on Sale</h3>
                </div>
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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {saleProducts.slice(0, 8).map((product) => {
                const isWishlistAdding = wishlistAdding === product._id;
                const inWishlist = isProductInWishlist(product);
                
                return (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ y: -4 }}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 relative"
                  >
                    <ProductCard
                      product={product}
                      onAddToCart={handleAddToCart}
                      isAdding={addingToCart}
                    />
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleWishlistToggle(product)}
                      disabled={isWishlistAdding}
                      className={`absolute top-3 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all ${
                        isWishlistAdding
                          ? 'bg-gray-400'
                          : inWishlist
                            ? 'bg-red-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
                      }`}
                    >
                      {isWishlistAdding ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                          <Icon.PiSpinner size={16} className="text-white" />
                        </motion.div>
                      ) : inWishlist ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        >
                          <Icon.PiHeartFill size={16} />
                        </motion.div>
                      ) : (
                        <Icon.PiHeart size={16} />
                      )}
                    </motion.button>
                    
                    {inWishlist && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute -top-1 -right-1 z-20 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-sm"
                      >
                        <Icon.PiCheck size={10} className="text-white" />
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
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

        {saleProducts.length > 0 && (
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-5 text-center border border-gray-200 hover:border-gray-300 transition-all duration-300 group hover:shadow-lg hover:-translate-y-1">
              <div className="text-3xl sm:text-4xl font-bold text-gray-900 group-hover:scale-110 transition-transform duration-300">{saleProducts.length}+</div>
              <div className="text-gray-500 text-sm mt-1 group-hover:text-gray-600 transition-colors duration-300">Products</div>
              <Icon.PiPackage size={20} className="mx-auto mt-2 text-gray-400 group-hover:text-gray-600 transition-colors duration-300" />
            </div>
            
            <div className="bg-gradient-to-br from-rose-50 to-rose-100 rounded-2xl p-5 text-center border border-rose-200 hover:border-rose-300 transition-all duration-300 group hover:shadow-lg hover:-translate-y-1 animate-glow">
              <div className="text-3xl sm:text-4xl font-bold text-rose-500 group-hover:scale-110 transition-transform duration-300">
                {Math.max(...saleProducts.map(p => p.availableAt?.[0]?.saleDiscountValue || 0))}%
              </div>
              <div className="text-rose-600 text-sm mt-1 group-hover:text-rose-700 transition-colors duration-300 font-medium">Max Discount</div>
              <Icon.PiPercent size={20} className="mx-auto mt-2 text-rose-400 group-hover:text-rose-600 transition-colors duration-300" />
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-2xl p-5 text-center border border-emerald-200 hover:border-emerald-300 transition-all duration-300 group hover:shadow-lg hover:-translate-y-1">
              <div className="text-3xl sm:text-4xl font-bold text-emerald-600 group-hover:scale-110 transition-transform duration-300">
                ₦{Math.min(...saleProducts.map(p => p.priceRange?.min || 0)).toLocaleString()}
              </div>
              <div className="text-emerald-600 text-sm mt-1 group-hover:text-emerald-700 transition-colors duration-300 font-medium">Starting From</div>
              <Icon.PiCurrencyNgn size={20} className="mx-auto mt-2 text-emerald-400 group-hover:text-emerald-600 transition-colors duration-300" />
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-5 text-center border border-orange-200 hover:border-orange-300 transition-all duration-300 group hover:shadow-lg hover:-translate-y-1">
              <div className="text-3xl sm:text-4xl font-bold text-orange-500 flex items-center justify-center gap-1 group-hover:scale-110 transition-transform duration-300">
                24<span className="text-lg animate-pulse">h</span>
              </div>
              <div className="text-orange-600 text-sm mt-1 group-hover:text-orange-700 transition-colors duration-300 font-medium">Ending Soon</div>
              <Icon.PiClock size={20} className="mx-auto mt-2 text-orange-400 group-hover:text-orange-600 transition-colors duration-300 animate-pulse" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FlashSale;
