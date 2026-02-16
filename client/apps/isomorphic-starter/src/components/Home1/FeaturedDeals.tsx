'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
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

interface FeaturedDeal {
  _id: string;
  name: string;
  slug: string;
  type: string;
  primaryImage?: { url: string; alt?: string };
  images?: Array<{ url: string }>;
  priceRange?: { min: number; max: number };
  averageRating?: number;
  reviewCount?: number;
  availableAt?: AvailableAtEntry[];
  isFeatured?: boolean;
}

interface FeaturedDealsProps {
  title?: string;
  subtitle?: string;
  limit?: number;
}

const DealCountdown = ({ endDate }: { endDate: string }) => {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const end = new Date(endDate).getTime();
      const now = new Date().getTime();
      const difference = end - now;

      if (difference > 0) {
        setTimeLeft({
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [endDate]);

  return (
    <div className="flex items-center gap-1.5">
      {[
        { value: timeLeft.hours, label: 'H' },
        { value: timeLeft.minutes, label: 'M' },
        { value: timeLeft.seconds, label: 'S' },
      ].map((item, idx) => (
        <React.Fragment key={item.label}>
          <div className={`flex items-center justify-center min-w-[28px] h-[28px] rounded-md ${
            idx === 0 ? 'bg-red-500' : idx === 1 ? 'bg-orange-500' : 'bg-amber-500'
          } text-white text-xs font-bold shadow-sm`}>
            {String(item.value).padStart(2, '0')}
          </div>
          {idx < 2 && <span className="text-gray-400 text-xs">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

const DealCard = ({ 
  deal, 
  onAddToCart, 
  isAdding,
  onToggleWishlist,
  isInWishlist,
  isWishlistAdding 
}: { 
  deal: FeaturedDeal;
  onAddToCart: (deal: FeaturedDeal) => void;
  isAdding: string | null;
  onToggleWishlist: (deal: FeaturedDeal) => void;
  isInWishlist: boolean;
  isWishlistAdding: boolean;
}) => {
  const mainImage = deal.primaryImage?.url || deal.images?.[0]?.url || '/images/placeholder-product.png';
  const availableAt = deal.availableAt?.[0];
  const sizeData = availableAt?.sizes?.[0];
  const pricing = sizeData?.pricing || availableAt?.pricing;
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const originalPrice = pricing?.websitePrice || deal.priceRange?.min || 0;
  const salePrice = availableAt?.salePrice;
  const currencySymbol = pricing?.currencySymbol || '₦';
  
  const hasDiscount = salePrice && salePrice < originalPrice;
  const discountPercent = hasDiscount ? Math.round((1 - salePrice / originalPrice) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-gray-200/50 transition-all duration-300 h-full group"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {!imageLoaded && (
          <motion.div 
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse z-10"
          />
        )}
        
        <Link href={`/product/${deal.slug}`}>
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative w-full h-full"
          >
            <Image
              src={mainImage}
              alt={deal.name}
              fill
              className={`object-cover transition-all duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onLoad={() => setImageLoaded(true)}
            />
          </motion.div>
        </Link>

        {hasDiscount && (
          <motion.div
            initial={{ opacity: 0, scale: 0, rotate: -10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="absolute top-3 left-3 bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg shadow-red-500/25 flex items-center gap-1 z-10"
          >
            <Icon.PiLightningFill size={12} />
            {discountPercent}% OFF
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-3 right-3 flex flex-col gap-2 z-20"
        >
          <motion.button
            whileHover={{ scale: 1.15, rotate: isInWishlist ? 0 : 10 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggleWishlist(deal)}
            disabled={isWishlistAdding}
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all backdrop-blur-md ${
              isWishlistAdding
                ? 'bg-gray-400'
                : isInWishlist
                  ? 'bg-red-500 text-white shadow-red-500/30'
                  : 'bg-white/90 text-gray-600 hover:bg-red-500 hover:text-white shadow-gray-200/50'
            }`}
          >
            {isWishlistAdding ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Icon.PiSpinner size={16} className="text-white" />
              </motion.div>
            ) : isInWishlist ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
              >
                <Icon.PiHeartFill size={16} />
              </motion.div>
            ) : (
              <Icon.PiHeart size={16} />
            )}
          </motion.button>

          {deal.averageRating && deal.averageRating > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg"
            >
              <Icon.PiStarFill size={14} className="text-amber-400" />
              <span className="text-xs font-bold text-gray-800">{deal.averageRating.toFixed(1)}</span>
            </motion.div>
          )}
        </motion.div>

        <motion.div 
          className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 transition-opacity duration-300 ${hasDiscount ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        >
          <DealCountdown endDate={new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileHover={{ opacity: 1, y: 0 }}
          className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10"
        >
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-xl text-gray-700 hover:text-rose-500 transition-colors"
            >
              <Icon.PiEye size={20} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-xl text-gray-700 hover:text-green-500 transition-colors"
            >
              <Icon.PiArrowsLeftRight size={20} />
            </motion.button>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          onClick={() => onAddToCart(deal)}
          disabled={isAdding === deal._id}
          className={`absolute bottom-0 left-0 right-0 z-20 py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg ${
            isAdding === deal._id
              ? 'bg-green-500 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          {isAdding === deal._id ? (
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
              <Icon.PiSpinner size={18} />
            </motion.div>
          ) : (
            <Icon.PiShoppingCart size={18} />
          )}
          Add to Cart
        </motion.button>
      </div>

      <div className="p-4">
        {availableAt?.tenant && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full mb-2 w-fit">
            <Icon.PiStorefront size={10} />
            <span>{availableAt.tenant.name}</span>
          </div>
        )}
        
        <Link href={`/product/${deal.slug}`}>
          <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-2 hover:text-rose-600 transition-colors mb-2">
            {deal.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2">
          {hasDiscount ? (
            <>
              <span className="text-xl font-bold text-gray-900">
                {currencySymbol}{salePrice?.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400 line-through">
                {currencySymbol}{originalPrice?.toLocaleString()}
              </span>
            </>
          ) : (
            <span className="text-xl font-bold text-gray-900">
              {currencySymbol}{originalPrice?.toLocaleString()}
            </span>
          )}
        </div>

        {sizeData?.size && (
          <div className="flex items-center gap-1 mt-1">
            <Icon.PiFlask size={12} className="text-gray-400" />
            <span className="text-xs text-gray-500">{sizeData.size}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

const FeaturedDeals: React.FC<FeaturedDealsProps> = ({
  title = "Featured Deals",
  subtitle = "Exclusive offers you can't resist",
  limit = 8
}) => {
  const [deals, setDeals] = useState<FeaturedDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [swiper, setSwiper] = useState<SwiperType | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { addToCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isProductInCart = useCallback((deal: FeaturedDeal) => {
    const availableAt = deal.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = availableAt?.sizes?.[0]?.size || 'default';
    const cartItemId = `${deal._id}-${size}-${tenantName}-default`;
    return cartState.cartArray.some(item => item.cartItemId === cartItemId);
  }, [cartState.cartArray]);

  const getCartQuantity = useCallback((deal: FeaturedDeal) => {
    const availableAt = deal.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = availableAt?.sizes?.[0]?.size || 'default';
    const cartItemId = `${deal._id}-${size}-${tenantName}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return cartItem?.quantity || 0;
  }, [cartState.cartArray]);

  const isProductInWishlist = useCallback((deal: FeaturedDeal) => {
    return wishlistState.wishlistArray.some(item => item.id === deal._id || item._id === deal._id);
  }, [wishlistState.wishlistArray]);

  const handleAddToCart = async (deal: FeaturedDeal) => {
    setAddingToCart(deal._id);
    try {
      const availableAt = deal.availableAt?.[0];
      const sizeData = availableAt?.sizes?.[0];
      const pricing = sizeData?.pricing || availableAt?.pricing;
      const size = sizeData?.size || 'Default';
      const tenantName = availableAt?.tenant?.name || '';
      const tenantId = availableAt?.tenant?._id || '';
      const cartItemId = `${deal._id}-${size}-${tenantName || 'default'}-default`;
      
      const existingItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
      const wasAlreadyInCart = !!existingItem;
      
      const productData = {
        _id: deal._id,
        id: deal._id,
        name: deal.name,
        slug: deal.slug,
        type: deal.type || 'beverage',
        price: availableAt?.salePrice || pricing?.websitePrice || deal.priceRange?.min || 0,
        originPrice: pricing?.originalWebsitePrice || deal.priceRange?.max || 0,
        primaryImage: deal.primaryImage || { url: deal.images?.[0]?.url || '/images/placeholder-product.png', alt: deal.name },
        images: deal.images || [],
        thumbImage: [deal.primaryImage?.url || deal.images?.[0]?.url || '/images/placeholder-product.png'],
        sale: true,
        createdAt: new Date().toISOString(),
      };

      await addToCart(
        productData,
        size,
        '',
        tenantName,
        tenantId,
        1,
        sizeData?._id || '',
        availableAt?._id || ''
      );
      
      await new Promise(resolve => setTimeout(resolve, 400));
      showToast(wasAlreadyInCart ? `Quantity increased to ${(existingItem?.quantity || 0) + 1}!` : `${deal.name} added to cart!`, 'success');
      openModalCart();
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setAddingToCart(null);
    }
  };

  const handleWishlistToggle = (deal: FeaturedDeal) => {
    setWishlistAdding(deal._id);
    try {
      const inWishlist = isProductInWishlist(deal);
      
      const wishlistItem = {
        id: deal._id,
        _id: deal._id,
        name: deal.name,
        slug: deal.slug,
        type: deal.type || 'beverage',
        price: deal.availableAt?.[0]?.salePrice || deal.priceRange?.min || 0,
        originPrice: deal.availableAt?.[0]?.pricing?.originalWebsitePrice || deal.priceRange?.max || 0,
        primaryImage: deal.primaryImage || { url: deal.images?.[0]?.url || '/images/placeholder-product.png', alt: deal.name },
        images: deal.images || [],
        thumbImage: [deal.primaryImage?.url || deal.images?.[0]?.url || '/images/placeholder-product.png'],
        sale: true,
        createdAt: new Date().toISOString(),
      };

      if (inWishlist) {
        removeFromWishlist(deal._id);
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
    const fetchDeals = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5001/api/products?isFeatured=true&onSale=true&limit=${limit}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setDeals(data.data?.products || data.products || []);
          }
        }
      } catch (error) {
        console.error('Error fetching deals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [limit]);

  if (loading) {
    return (
      <section className="py-12 md:py-20 bg-gradient-to-b from-rose-50 via-white to-rose-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 rounded-full text-sm font-medium text-rose-700 mb-4">
              <Icon.PiTag size={16} className="text-rose-600" />
              Hot Deals
            </div>
            <div className="h-10 bg-gray-200 rounded-full w-64 mx-auto shimmer" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] bg-gray-200 rounded-2xl shimmer" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (deals.length === 0) return null;

  return (
    <section className="py-12 md:py-20 bg-gradient-to-b from-rose-50 via-white to-rose-50 overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity }}
          className="absolute -top-40 -right-40 w-[400px] h-[400px] bg-gradient-to-br from-rose-200/40 to-pink-200/40 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, delay: 1 }}
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-br from-orange-200/40 to-amber-200/40 rounded-full blur-3xl"
        />
      </div>

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

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-100 border border-rose-200 rounded-full mb-4"
          >
            <Icon.PiTag size={16} className="text-rose-600" />
            <span className="text-sm font-medium text-rose-700">Limited Time</span>
          </motion.div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">{title}</h2>
          <p className="text-gray-500 text-base md:text-lg max-w-2xl mx-auto">{subtitle}</p>
        </motion.div>

        <div className="relative">
          <Swiper
            modules={[Navigation, Pagination]}
            onSwiper={setSwiper}
            onSlideChange={(swiper) => setActiveIndex(Math.floor(swiper.activeIndex / 4))}
            breakpoints={{
              320: {
                slidesPerView: 2,
                spaceBetween: 12
              },
              640: {
                slidesPerView: 2,
                spaceBetween: 16
              },
              1024: {
                slidesPerView: 4,
                spaceBetween: 20
              }
            }}
            className="!overflow-visible"
          >
            {deals.map((deal, index) => (
              <SwiperSlide key={deal._id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                >
                  <DealCard
                    deal={deal}
                    onAddToCart={handleAddToCart}
                    isAdding={addingToCart}
                    onToggleWishlist={handleWishlistToggle}
                    isInWishlist={isProductInWishlist(deal)}
                    isWishlistAdding={wishlistAdding === deal._id}
                  />
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>

          {deals.length > 4 && (
            <>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  swiper?.slidePrev();
                  setActiveIndex(Math.max(0, activeIndex - 1));
                }}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 z-20 w-10 h-10 md:w-12 md:h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-900 hover:text-white transition-all duration-300 hidden md:flex"
              >
                <Icon.PiArrowLeft size={20} />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  swiper?.slideNext();
                  setActiveIndex(Math.min(Math.ceil(deals.length / 4) - 1, activeIndex + 1));
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 z-20 w-10 h-10 md:w-12 md:h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-900 hover:text-white transition-all duration-300 hidden md:flex"
              >
                <Icon.PiArrowRight size={20} />
              </motion.button>

              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: Math.ceil(deals.length / 4) }).map((_, idx) => (
                  <motion.button
                    key={idx}
                    onClick={() => {
                      swiper?.slideTo(idx * 4);
                      setActiveIndex(idx);
                    }}
                    whileHover={{ scale: 1.2 }}
                    className={`relative w-2 h-2 rounded-full transition-all duration-300 ${
                      activeIndex === idx
                        ? 'bg-rose-500 w-8'
                        : 'bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center mt-10"
        >
          <Link
            href="/shop?sale=true"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
          >
            View All Deals
            <Icon.PiArrowRight size={18} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedDeals;
