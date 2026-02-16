'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay, Pagination } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';

interface ProductSize {
  _id: string;
  size: string;
  volumeMl?: number;
  stock: number;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
  };
}

interface AvailableAtEntry {
  _id?: string;
  tenant?: {
    _id: string;
    name: string;
    slug: string;
  };
  sizes?: ProductSize[];
  isOnSale?: boolean;
  salePrice?: number;
  saleDiscountValue?: number;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
  };
  totalStock?: number;
  availableStock?: number;
}

interface TabProduct {
  _id: string;
  id: string;
  name: string;
  slug: string;
  type: string;
  price: number;
  originPrice: number;
  sale: boolean;
  discount: number;
  new: boolean;
  sold: number;
  totalStock: number;
  availableStock: number;
  thumbImage: string[];
  primaryImage?: { url: string };
  images?: Array<{ url: string }>;
  category?: { name: string; slug: string };
  averageRating: number;
  reviewCount: number;
  badge?: { type: string; name: string; color: string };
  availableAt?: AvailableAtEntry[];
  defaultSize?: string;
  abv?: number;
  originCountry?: string;
}

interface TabConfig {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  apiEndpoint: string;
}

const TabFeatures: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('on-sale');
  const [isAnimating, setIsAnimating] = useState(false);
  const [products, setProducts] = useState<TabProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const swiperRef = useRef<SwiperType | null>(null);

  const { addToCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

  const tabs: TabConfig[] = [
    {
      id: 'best-sellers',
      label: 'Best Sellers',
      icon: <Icon.PiTrophyFill size={18} />,
      description: 'Most popular products',
      apiEndpoint: '/api/products?sort=bestSelling&limit=12'
    },
    {
      id: 'on-sale',
      label: 'On Sale',
      icon: <Icon.PiTagFill size={18} />,
      description: 'Special discounts',
      apiEndpoint: '/api/products?onSale=true&limit=12'
    },
    {
      id: 'new-arrivals',
      label: 'New Arrivals',
      icon: <Icon.PiSparkleFill size={18} />,
      description: 'Fresh additions',
      apiEndpoint: '/api/products?sort=newest&limit=12'
    }
  ];

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const mapApiProductToProduct = (apiProduct: any): TabProduct => {
    const availableAt = apiProduct.availableAt?.[0];
    const sizeData = availableAt?.sizes?.[0];
    const pricing = sizeData?.pricing || availableAt?.pricing;
    
    const websitePrice = pricing?.websitePrice || apiProduct.priceRange?.min || 0;
    const originalPrice = pricing?.originalWebsitePrice || apiProduct.priceRange?.max || websitePrice;
    
    const isOnSale = availableAt?.isOnSale || apiProduct.discount?.value > 0;
    const saleDiscountValue = availableAt?.saleDiscountValue || apiProduct.discount?.value || 0;
    
    const sale = isOnSale && saleDiscountValue > 0;
    const price = sale ? Math.round(originalPrice * (1 - saleDiscountValue / 100)) : websitePrice;
    const discount = sale ? Math.round(saleDiscountValue) : 0;

    const isNew = apiProduct.createdAt 
      ? (() => {
          try {
            const createdDate = new Date(apiProduct.createdAt);
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            return createdDate > weekAgo;
          } catch {
            return false;
          }
        })()
      : false;

    const totalStock = availableAt?.totalStock || apiProduct.stockInfo?.totalStock || 100;
    const availableStock = availableAt?.availableStock || apiProduct.stockInfo?.availableStock || totalStock;
    const totalSold = apiProduct.totalSold || (totalStock - availableStock);

    const thumbImage: string[] = [];
    if (apiProduct.primaryImage?.url) {
      thumbImage.push(apiProduct.primaryImage.url);
    }
    if (apiProduct.images && apiProduct.images.length > 0) {
      apiProduct.images.forEach((img: any) => {
        if (img.url && !thumbImage.includes(img.url)) {
          thumbImage.push(img.url);
        }
      });
    }
    if (thumbImage.length === 0) {
      thumbImage.push('/images/placeholder-product.png');
    }

    return {
      _id: apiProduct._id,
      id: apiProduct._id,
      name: apiProduct.name,
      slug: apiProduct.slug,
      type: apiProduct.type || 'beverage',
      price,
      originPrice: originalPrice,
      sale,
      discount,
      new: isNew,
      sold: totalSold,
      totalStock,
      availableStock,
      thumbImage: thumbImage.slice(0, 2),
      primaryImage: apiProduct.primaryImage,
      images: apiProduct.images?.map((img: any) => ({ url: img.url })),
      category: apiProduct.category,
      averageRating: apiProduct.averageRating || 0,
      reviewCount: apiProduct.reviewCount || 0,
      badge: apiProduct.badge?.name
        ? { type: apiProduct.badge.type || 'default', name: apiProduct.badge.name, color: apiProduct.badge.color || '#10B981' }
        : sale ? { type: 'sale', name: `${discount}% OFF`, color: '#ef4444' }
        : isNew ? { type: 'new', name: 'NEW', color: '#10B981' }
        : undefined,
      availableAt: apiProduct.availableAt,
      defaultSize: sizeData?.size || apiProduct.volumeMl ? `${apiProduct.volumeMl}ml` : undefined,
      abv: apiProduct.abv,
      originCountry: apiProduct.originCountry
    };
  };

  const fetchProducts = async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_URL}${tab.apiEndpoint}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }
      
      const data = await response.json();
      
      if (data.success && (data.data?.products || data.products)) {
        const productsData = data.data?.products || data.products;
        setProducts(productsData.map(mapApiProductToProduct));
      } else {
        setError('No products found');
        setProducts([]);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts(activeTab);
  }, [activeTab]);

  const isProductInCart = useCallback((product: TabProduct) => {
    const availableAt = product.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = availableAt?.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    return cartState.cartArray.some(item => item.cartItemId === cartItemId);
  }, [cartState.cartArray]);

  const getCartQuantity = useCallback((product: TabProduct) => {
    const availableAt = product.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = availableAt?.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return cartItem?.quantity || 0;
  }, [cartState.cartArray]);

  const isProductInWishlist = useCallback((product: TabProduct) => {
    return wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
  }, [wishlistState.wishlistArray]);

  const handleAddToCart = async (product: TabProduct) => {
    setAddingToCart(product._id);
    try {
      const availableAt = product.availableAt?.[0];
      const sizeData = availableAt?.sizes?.[0];
      const size = sizeData?.size || 'Default';
      const tenantName = availableAt?.tenant?.name || '';
      const tenantId = availableAt?.tenant?._id || '';
      const cartItemId = `${product._id}-${size}-${tenantName || 'default'}-default`;
      
      const existingItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
      const wasAlreadyInCart = !!existingItem;
      
      await addToCart(
        {
          _id: product._id,
          id: product._id,
          name: product.name,
          slug: product.slug,
          type: product.type,
          price: product.price,
          originPrice: product.originPrice,
          thumbImage: product.thumbImage,
          primaryImage: product.primaryImage,
          images: product.images
        } as any,
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

  const handleWishlistToggle = (product: TabProduct) => {
    setWishlistAdding(product._id);
    try {
      const inWishlist = isProductInWishlist(product);
      
      if (inWishlist) {
        removeFromWishlist(product._id);
        showToast('Removed from wishlist', 'success');
      } else {
        addToWishlist({
          id: product._id,
          _id: product._id,
          name: product.name,
          slug: product.slug,
          type: product.type,
          price: product.price,
          originPrice: product.originPrice,
          primaryImage: product.primaryImage || { url: product.thumbImage[0] || '/images/placeholder-product.png', alt: product.name },
          images: product.images || [],
          thumbImage: product.thumbImage,
          sale: product.sale,
          createdAt: new Date().toISOString()
        } as any);
        showToast('Added to wishlist!', 'success');
        setTimeout(() => openModalWishlist(), 300);
      }
    } catch {
      showToast('Failed to update wishlist', 'error');
    } finally {
      setWishlistAdding(null);
    }
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === activeTab || isAnimating) return;
    
    setIsAnimating(true);
    setActiveTab(tabId);
    
    if (swiperRef.current) {
      swiperRef.current.slideTo(0);
    }
    
    setTimeout(() => setIsAnimating(false), 500);
  };

  const formatPrice = (price: number) => '₦' + Math.round(price).toLocaleString();

  const getSoldPercentage = (product: TabProduct) => {
    if (product.totalStock <= 0) return 0;
    return Math.min(100, Math.round((product.sold / product.totalStock) * 100));
  };

  const getStockStatus = (product: TabProduct) => {
    const percentage = getSoldPercentage(product);
    if (percentage >= 90) return { text: 'Almost Gone', color: 'text-red-500', bg: 'bg-red-500' };
    if (percentage >= 70) return { text: 'Selling Fast', color: 'text-orange-500', bg: 'bg-orange-500' };
    if (percentage >= 50) return { text: 'Limited Stock', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    return { text: 'In Stock', color: 'text-green-500', bg: 'bg-green-500' };
  };

  const getMainBadge = (product: TabProduct) => {
    if (product.sale && product.discount > 0) {
      return { type: 'sale' as const, text: `-${product.discount}%`, color: 'bg-red-500' };
    }
    if (product.new) {
      return { type: 'new' as const, text: 'NEW', color: 'bg-green-500' };
    }
    if (product.badge && product.badge.name) {
      return { type: 'badge' as const, text: product.badge.name, color: '' };
    }
    return null;
  };

  const activeTabConfig = tabs.find(t => t.id === activeTab);

  if (loading) {
    return (
      <section className="py-16 md:py-24 bg-gradient-to-b from-white via-gray-50/50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium mb-4">
              <Icon.PiStarFill size={16} className="text-amber-400" />
              Curated Selection
            </div>
            <div className="h-12 bg-gray-200 rounded-full w-64 mx-auto mb-4 shimmer" />
            <div className="h-6 bg-gray-200 rounded-full w-96 mx-auto" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-gray-200 rounded-2xl shimmer" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <Icon.PiWarning size={40} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Oops!</h3>
          <p className="text-gray-600 mb-5">{error}</p>
          <button
            onClick={() => fetchProducts(activeTab)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all"
          >
            <Icon.PiArrowClockwise size={18} />
            Try Again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-white via-gray-50/50 to-white overflow-hidden relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-2.5 ${
              toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
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
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium mb-4"
          >
            <Icon.PiStarFill size={16} className="text-amber-400" />
            Curated Selection
          </motion.span>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Featured Products
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {activeTabConfig?.description || 'Discover our handpicked collection of premium beverages'}
          </p>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-10"
        >
          <div className="inline-flex items-center gap-1 p-1.5 bg-gray-100 rounded-2xl">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              
              return (
                <motion.button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`relative flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300 ${
                    isActive
                      ? 'text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <AnimatePresence>
                    {isActive && (
                      <motion.div
                        layoutId="activeTabBg"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="absolute inset-0 bg-white rounded-xl shadow-lg shadow-gray-200/50"
                      />
                    )}
                  </AnimatePresence>

                  <motion.span
                    className={`relative z-10 transition-colors duration-300 ${
                      isActive ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                    animate={{ 
                      rotate: isActive ? [0, -10, 10, 0] : 0,
                      scale: isActive ? 1.1 : 1
                    }}
                    transition={{ duration: 0.5 }}
                  >
                    {tab.icon}
                  </motion.span>

                  <span className="relative z-10">{tab.label}</span>

                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full"
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Products Section */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          >
            {products.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon.PiPackage size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Products Found</h3>
                <p className="text-gray-500">Check back later for new arrivals!</p>
              </motion.div>
            ) : (
              <div className="relative">
                <Swiper
                  onSwiper={(swiper) => (swiperRef.current = swiper)}
                  spaceBetween={16}
                  slidesPerView={2}
                  navigation={{
                    prevEl: '.tab-prev',
                    nextEl: '.tab-next'
                  }}
                  pagination={{
                    clickable: true,
                    dynamicBullets: true
                  }}
                  loop={products.length > 4}
                  modules={[Navigation, Autoplay, Pagination]}
                  autoplay={{
                    delay: 4000,
                    disableOnInteraction: false,
                    pauseOnMouseEnter: true
                  }}
                  breakpoints={{
                    320: { slidesPerView: 1.5, spaceBetween: 12 },
                    480: { slidesPerView: 2, spaceBetween: 16 },
                    768: { slidesPerView: 3, spaceBetween: 20 },
                    1024: { slidesPerView: 4, spaceBetween: 24 },
                    1280: { slidesPerView: 4, spaceBetween: 30 }
                  }}
                  className="pb-12"
                >
                  {products.map((product, index) => {
                    const isAdding = addingToCart === product._id;
                    const isWishlistAdding = wishlistAdding === product._id;
                    const inWishlist = isProductInWishlist(product);
                    const inCart = isProductInCart(product);
                    const cartQty = getCartQuantity(product);
                    const mainBadge = getMainBadge(product);
                    const stockStatus = getStockStatus(product);
                    const soldPercentage = getSoldPercentage(product);

                    return (
                      <SwiperSlide key={product.id}>
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ 
                            delay: index * 0.08,
                            duration: 0.5,
                            ease: 'easeOut'
                          }}
                          className="h-full"
                        >
                          <motion.div
                            whileHover={{ y: -8 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                            className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 h-full flex flex-col"
                          >
                            {/* Image Container */}
                            <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
                              <Link href={`/product/${product.slug}`}>
                                <motion.div
                                  whileHover={{ scale: 1.05 }}
                                  transition={{ duration: 0.4 }}
                                  className="relative w-full h-full"
                                >
                                  <Image
                                    src={product.thumbImage[0] || '/images/placeholder-product.png'}
                                    alt={product.name}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                  />
                                </motion.div>
                              </Link>

                              {/* Badge */}
                              {mainBadge && (
                                <motion.div
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-md ${mainBadge.color}`}
                                  style={mainBadge.type === 'badge' && product.badge?.color ? { backgroundColor: product.badge.color } : {}}
                                >
                                  {mainBadge.text}
                                </motion.div>
                              )}

                              {/* Wishlist Button */}
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleWishlistToggle(product)}
                                disabled={isWishlistAdding}
                                className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-all ${
                                  isWishlistAdding 
                                    ? 'bg-gray-400' 
                                    : inWishlist 
                                      ? 'bg-red-500 text-white' 
                                      : 'bg-white/90 backdrop-blur-sm text-gray-600 hover:bg-red-500 hover:text-white'
                                }`}
                              >
                                {isWishlistAdding ? (
                                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                    <Icon.PiSpinner size={16} />
                                  </motion.div>
                                ) : inWishlist ? (
                                  <Icon.PiHeartFill size={16} />
                                ) : (
                                  <Icon.PiHeart size={16} />
                                )}
                              </motion.button>

                              {/* Add to Cart Button at Bottom of Image */}
                              <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                whileHover={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleAddToCart(product);
                                }}
                                disabled={isAdding || inCart}
                                className={`absolute bottom-0 left-0 right-0 z-20 py-3 px-4 font-semibold text-sm flex items-center justify-center gap-2 shadow-lg ${
                                  isAdding 
                                    ? 'bg-green-500 text-white' 
                                    : inCart 
                                      ? 'bg-green-100 text-green-700 border-t-2 border-green-300'
                                      : 'bg-gray-900 text-white'
                                }`}
                              >
                                {isAdding ? (
                                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                    <Icon.PiSpinner size={18} />
                                  </motion.div>
                                ) : (
                                  <Icon.PiShoppingCart size={18} />
                                )}
                                {isAdding ? 'Adding...' : inCart ? `In Cart (${cartQty})` : 'Add to Cart'}
                              </motion.button>
                            </div>

                            {/* Content */}
                            <div className="p-4 flex-1 flex flex-col">
                              {/* Vendor */}
                              {product.availableAt?.[0]?.tenant && (
                                <div className="flex items-center gap-1 text-[10px] font-medium text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full mb-2 w-fit">
                                  <Icon.PiStorefront size={10} />
                                  <span>{product.availableAt[0].tenant.name}</span>
                                </div>
                              )}
                              
                              {/* Product Name */}
                              <Link href={`/product/${product.slug}`}>
                                <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-2 hover:text-rose-600 transition-colors mb-2 flex-1">
                                  {product.name}
                                </h3>
                              </Link>

                              {/* Rating */}
                              {product.averageRating > 0 && (
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <motion.div
                                        key={i}
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: i * 0.05 }}
                                      >
                                        <Icon.PiStarFill
                                          size={12}
                                          className={i < Math.floor(product.averageRating) ? 'text-amber-400' : 'text-gray-200'}
                                        />
                                      </motion.div>
                                    ))}
                                  </div>
                                  <span className="text-xs text-gray-500">({product.reviewCount})</span>
                                </div>
                              )}

                              {/* Price */}
                              <div className="flex items-center gap-2 mb-2">
                                {product.sale ? (
                                  <>
                                    <span className="text-lg font-bold text-gray-900">
                                      {formatPrice(product.price)}
                                    </span>
                                    <span className="text-sm text-gray-400 line-through">
                                      {formatPrice(product.originPrice)}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-lg font-bold text-gray-900">
                                    {formatPrice(product.price)}
                                  </span>
                                )}
                              </div>

                              {/* Size & Info */}
                              <div className="flex items-center gap-2 flex-wrap">
                                {product.defaultSize && (
                                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                    <Icon.PiFlask size={12} />
                                    {product.defaultSize}
                                  </span>
                                )}
                                {product.abv && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 rounded text-xs">
                                    <Icon.PiWine size={12} />
                                    {product.abv}%
                                  </span>
                                )}
                              </div>

                              {/* Stock Progress */}
                              <div className="mt-3 pt-3 border-t border-gray-100">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className={`font-medium ${stockStatus.color}`}>{stockStatus.text}</span>
                                  <span className="text-gray-400">{soldPercentage}% sold</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${soldPercentage}%` }}
                                    transition={{ duration: 0.8, delay: index * 0.1 }}
                                    className={`h-full rounded-full ${stockStatus.bg}`}
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        </motion.div>
                      </SwiperSlide>
                    );
                  })}
                </Swiper>

                {/* Custom Navigation Arrows */}
                <motion.button
                  whileHover={{ scale: 1.1, x: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="tab-prev absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-12 h-12 bg-white rounded-full shadow-lg shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-indigo-600 hover:shadow-xl transition-all hidden md:flex"
                >
                  <Icon.PiArrowLeft size={20} />
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.1, x: 3 }}
                  whileTap={{ scale: 0.95 }}
                  className="tab-next absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-12 h-12 bg-white rounded-full shadow-lg shadow-gray-200/50 flex items-center justify-center text-gray-700 hover:text-indigo-600 hover:shadow-xl transition-all hidden md:flex"
                >
                  <Icon.PiArrowRight size={20} />
                </motion.button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <motion.a
            href="/shop"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
          >
            View All Products
            <Icon.PiArrowRight size={18} />
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
};

export default TabFeatures;
