'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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

const DealCountdown = ({ hours = 24, minutes = 0, seconds = 0 }: { hours?: number; minutes?: number; seconds?: number }) => {
  const [timeLeft, setTimeLeft] = useState({ hours, minutes, seconds });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = new Date();
      target.setHours(target.getHours() + hours);
      target.setMinutes(target.getMinutes() + minutes);
      target.setSeconds(target.getSeconds() + seconds);
      
      const now = new Date().getTime();
      const diff = target.getTime() - now;

      if (diff > 0) {
        setTimeLeft({
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / (1000 * 60)) % 60),
          seconds: Math.floor((diff / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [hours, minutes, seconds]);

  const units = [
    { value: timeLeft.hours, label: 'Hours', bg: 'bg-red-500' },
    { value: timeLeft.minutes, label: 'Mins', bg: 'bg-orange-500' },
    { value: timeLeft.seconds, label: 'Secs', bg: 'bg-amber-500' },
  ];

  return (
    <div className="flex items-center gap-2">
      {units.map((unit, idx) => (
        <React.Fragment key={unit.label}>
          <div className="flex flex-col items-center">
            <div className={`${unit.bg} text-white px-2 py-1 rounded-lg min-w-[40px] text-center shadow-lg`}>
              <span className="text-sm font-bold">{String(unit.value).padStart(2, '0')}</span>
            </div>
            <span className="text-[9px] text-white/70 mt-1 font-medium">{unit.label}</span>
          </div>
          {idx < units.length - 1 && <span className="text-white/70 text-lg font-bold -mt-2">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

const DealCard = ({ 
  deal, 
  onAddToCart, 
  onRemoveFromCart,
  isAdding,
  onToggleWishlist,
  isInWishlist,
  isWishlistAdding,
  inCart,
  cartQty
}: { 
  deal: FeaturedDeal;
  onAddToCart: (deal: FeaturedDeal, size?: ProductSize) => void;
  onRemoveFromCart?: (deal: FeaturedDeal) => void;
  isAdding: string | null;
  onToggleWishlist: (deal: FeaturedDeal) => void;
  isInWishlist: boolean;
  isWishlistAdding: boolean;
  inCart: boolean;
  cartQty: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  const mainImage = deal.primaryImage?.url || deal.images?.[0]?.url;
  const availableAt = deal.availableAt?.[0];
  const sizes = availableAt?.sizes || [];
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(sizes[0] || null);
  const pricing = selectedSize?.pricing || availableAt?.pricing;
  
  const originalPrice = pricing?.websitePrice || deal.priceRange?.min || 0;
  const salePrice = availableAt?.salePrice;
  
  const hasDiscount = salePrice && salePrice < originalPrice;
  const discountPercent = hasDiscount ? Math.round((1 - salePrice / originalPrice) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
    >
      {/* Card */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100">
        {/* Image Section */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          <Link href={`/product/${deal.slug}`}>
            <div className="relative w-full h-full">
              {!imgError && mainImage ? (
                <img
                  src={mainImage}
                  alt={deal.name}
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${
                    isHovered ? 'scale-110' : 'scale-100'
                  }`}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                  <span className="text-5xl opacity-30">🔥</span>
                </div>
              )}
              
              {/* Discount Badge */}
              {hasDiscount && (
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  className="absolute top-3 left-3 z-10"
                >
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 blur-md opacity-40 rounded-lg" />
                    <div className="relative bg-gradient-to-r from-red-500 to-rose-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1">
                      <Icon.PiLightningFill size={10} className="animate-pulse" />
                      -{discountPercent}%
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Wishlist Button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onToggleWishlist(deal)}
                disabled={isWishlistAdding}
                className={`absolute top-3 right-3 z-20 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isWishlistAdding
                    ? 'bg-gray-400'
                    : isInWishlist
                      ? 'bg-red-500 text-white'
                      : 'bg-white/95 backdrop-blur-sm text-gray-500 hover:bg-red-50 hover:text-red-500'
                }`}
              >
                {isWishlistAdding ? (
                  <Icon.PiSpinner size={18} className="animate-spin" />
                ) : isInWishlist ? (
                  <Icon.PiHeartFill size={18} />
                ) : (
                  <Icon.PiHeart size={18} />
                )}
              </motion.button>

              {/* Tenant Badge */}
              {availableAt?.tenant && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-3 left-3 z-10"
                >
                  <div className="bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-md border border-gray-100">
                    <span className="text-[10px] font-medium text-gray-600 truncate max-w-[80px] block">
                      {availableAt.tenant.name}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Quick Add to Cart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
                className="absolute bottom-3 right-3 z-20"
              >
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.preventDefault();
                    if (inCart && onRemoveFromCart) {
                      onRemoveFromCart(deal);
                    } else {
                      onAddToCart(deal, selectedSize || undefined);
                    }
                  }}
                  disabled={isAdding === deal._id}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    isAdding === deal._id
                      ? 'bg-red-500 text-white'
                      : inCart
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                  }`}
                >
                  {isAdding === deal._id ? (
                    <Icon.PiSpinner size={18} className="animate-spin" />
                  ) : inCart ? (
                    <Icon.PiTrash size={18} />
                  ) : (
                    <Icon.PiPlus size={18} />
                  )}
                </motion.button>
              </motion.div>
            </div>
          </Link>
        </div>

        {/* Content Section */}
        <div className="p-4">
          {/* Deal Countdown */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-1.5">
              <Icon.PiClock size={10} />
              <span>Ends in:</span>
            </div>
            <DealCountdown hours={4} minutes={30} seconds={0} />
          </div>

          {/* Product Name */}
          <Link href={`/product/${deal.slug}`}>
            <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-red-600 transition-colors min-h-[2.5rem]">
              {deal.name}
            </h3>
          </Link>

          {/* Rating */}
          {deal.averageRating && deal.averageRating > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon.PiStarFill
                    key={i}
                    size={10}
                    className={i < Math.floor(deal.averageRating || 0) ? 'text-amber-400' : 'text-gray-200'}
                  />
                ))}
              </div>
              <span className="text-[10px] text-gray-500">
                {deal.averageRating.toFixed(1)} ({deal.reviewCount || 0})
              </span>
            </div>
          )}

          {/* Price Section */}
          <div className="mt-3 flex items-end gap-2">
            {hasDiscount ? (
              <>
                <span className="text-lg font-black text-gray-900">
                  ₦{salePrice?.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  ₦{originalPrice.toLocaleString()}
                </span>
                <span className="ml-auto text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                  Save {discountPercent}%
                </span>
              </>
            ) : (
              <span className="text-lg font-black text-gray-900">
                ₦{originalPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* Size Selector */}
          {sizes.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {sizes.slice(0, 3).map((size) => (
                <button
                  key={size._id}
                  onClick={() => setSelectedSize(size)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                    selectedSize?._id === size._id
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {size.size}
                </button>
              ))}
              {sizes.length > 3 && (
                <span className="px-2 py-0.5 text-[10px] text-gray-400">
                  +{sizes.length - 3}
                </span>
              )}
            </div>
          )}

          {/* In Cart Indicator */}
          {inCart && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              <Icon.PiShoppingCart size={14} />
              {cartQty} in cart
            </motion.div>
          )}
        </div>
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

  const { addToCart, removeFromCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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

  const handleAddToCart = async (deal: FeaturedDeal, selectedSize?: ProductSize) => {
    setAddingToCart(deal._id);
    try {
      const availableAt = deal.availableAt?.[0];
      const sizeData = selectedSize || availableAt?.sizes?.[0];
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
      
      showToast(wasAlreadyInCart ? `Quantity increased to ${(existingItem?.quantity || 0) + 1}!` : `${deal.name} added to cart!`, 'success');
      openModalCart();
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setTimeout(() => setAddingToCart(null), 300);
    }
  };

  const handleRemoveFromCart = (deal: FeaturedDeal) => {
    try {
      const cartItem = cartState.cartArray.find(item => item.cartItemId.startsWith(deal._id));
      if (cartItem) {
        removeFromCart(cartItem.cartItemId);
        showToast(`${deal.name} removed from cart`, 'success');
      }
    } catch {
      showToast('Failed to remove from cart', 'error');
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
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${API_URL}/api/products?isFeatured=true&onSale=true&limit=${limit}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setDeals(data.data?.products || data.products || []);
          }
        }
      } catch {
        console.warn('Using fallback products due to API error:');
        setDeals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDeals();
  }, [limit]);

  if (loading) {
    return (
      <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-red-50/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 rounded-full text-xs font-bold text-red-700 mb-4">
              <Icon.PiLightningFill size={14} />
              Hot Deals
            </div>
            <div className="h-12 bg-gray-200 rounded-xl w-56 mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="aspect-square bg-gray-200 rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (deals.length === 0) return null;

  const totalSavings = deals.reduce((sum, deal) => {
    const availableAt = deal.availableAt?.[0];
    const pricing = availableAt?.sizes?.[0]?.pricing || availableAt?.pricing;
    const original = pricing?.websitePrice || deal.priceRange?.min || 0;
    const sale = availableAt?.salePrice;
    if (sale && sale < original) {
      return sum + (original - sale);
    }
    return sum;
  }, 0);

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white via-red-50/20 to-white overflow-hidden">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-2.5 text-white ${
              toast.type === 'success' ? 'bg-red-500' : 'bg-red-600'
            }`}
          >
            {toast.type === 'success' ? <Icon.PiCheckCircle size={20} /> : <Icon.PiWarning size={20} />}
            <span className="font-medium text-sm">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-100 to-orange-100 rounded-full text-xs font-bold text-red-700 mb-4 shadow-sm"
          >
            <Icon.PiLightningFill size={14} className="text-red-500" />
            Limited Time Offers
          </motion.div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            {title}
          </h2>
          
          <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
            {subtitle}
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-100 to-orange-100 flex items-center justify-center">
                <Icon.PiTagDuotone size={18} className="text-red-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">{deals.length}</div>
                <div className="text-xs text-gray-500">Hot Deals</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                <Icon.PiCurrencyNgn size={18} className="text-emerald-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">₦{totalSavings.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Total Savings</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Deals Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {deals.map((deal, index) => (
            <DealCard
              key={deal._id}
              deal={deal}
              onAddToCart={handleAddToCart}
              onRemoveFromCart={handleRemoveFromCart}
              isAdding={addingToCart}
              onToggleWishlist={handleWishlistToggle}
              isInWishlist={isProductInWishlist(deal)}
              isWishlistAdding={wishlistAdding === deal._id}
              inCart={isProductInCart(deal)}
              cartQty={getCartQuantity(deal)}
            />
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            href="/shop?sale=true"
            className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold rounded-full hover:from-red-700 hover:to-rose-700 transition-all shadow-lg hover:shadow-xl"
          >
            View All Deals
            <Icon.PiArrowRight size={20} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedDeals;
