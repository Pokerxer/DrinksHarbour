'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { useCompare } from '@/context/CompareContext';
import { useModalCompareContext } from '@/context/ModalCompareContext';
import { getInitials, VENDOR_PALETTE, vendorPaletteIndex } from '@/data/vendor-helpers';

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
    logo?: string;
  };
  sizes?: ProductSize[];
  isOnSale?: boolean;
  saleDiscountValue?: number;
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
  accentColor: string;
  gradient: string;
}

const TabFeatures: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('on-sale');
  const [products, setProducts] = useState<TabProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [showToast, setShowToast] = useState(false);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const swiperRef = useRef<SwiperType | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { addToCart, removeFromCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const { openQuickview } = useModalQuickviewContext();
  const { addToCompare, isInCompare } = useCompare();
  const { openModalCompare } = useModalCompareContext();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

  const tabs: TabConfig[] = [
    { id: 'best-sellers', label: 'Best Sellers', icon: <Icon.PiTrophyFill size={18} />, description: 'Most popular products', apiEndpoint: '/api/products?sort=bestSelling&limit=12', accentColor: 'amber', gradient: 'from-amber-500 to-orange-500' },
    { id: 'on-sale', label: 'On Sale', icon: <Icon.PiTagFill size={18} />, description: 'Special discounts', apiEndpoint: '/api/products?onSale=true&limit=12', accentColor: 'rose', gradient: 'from-rose-500 to-pink-500' },
    { id: 'new-arrivals', label: 'New Arrivals', icon: <Icon.PiSparkleFill size={18} />, description: 'Fresh additions', apiEndpoint: '/api/products?sort=newest&limit=12', accentColor: 'violet', gradient: 'from-violet-500 to-purple-500' }
  ];

  const activeTabConfig = tabs.find(t => t.id === activeTab);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    toastTimeoutRef.current = setTimeout(() => setShowToast(false), 3500);
  };

  const mapProduct = (apiProduct: any): TabProduct => {
    const availableAt = apiProduct.availableAt?.[0];
    const sizeData = availableAt?.sizes?.[0];
    const pricing = sizeData?.pricing || availableAt?.pricing;
    const websitePrice = pricing?.websitePrice || apiProduct.priceRange?.min || 0;
    const originalPrice = pricing?.originalWebsitePrice || apiProduct.priceRange?.max || websitePrice;
    const isOnSale = availableAt?.isOnSale || (apiProduct.discount?.value > 0);
    const saleDiscountValue = availableAt?.saleDiscountValue || apiProduct.discount?.value || 0;
    const sale = Boolean(isOnSale && saleDiscountValue > 0);
    const price = sale ? Math.round(originalPrice * (1 - saleDiscountValue / 100)) : websitePrice;
    const discount = sale ? Math.round(saleDiscountValue) : 0;
    const isNew = apiProduct.createdAt ? (() => { try { const d = new Date(apiProduct.createdAt); const w = new Date(); w.setDate(w.getDate() - 7); return d > w; } catch { return false; } })() : false;
    const totalStock = availableAt?.totalStock || apiProduct.stockInfo?.totalStock || 100;
    const availableStock = availableAt?.availableStock || apiProduct.stockInfo?.availableStock || totalStock;
    const thumbImage: string[] = [];
    if (apiProduct.primaryImage?.url) thumbImage.push(apiProduct.primaryImage.url);
    if (apiProduct.images?.length) { apiProduct.images.forEach((img: any) => { if (img.url && !thumbImage.includes(img.url)) thumbImage.push(img.url); }); }
    if (!thumbImage.length) thumbImage.push('/images/placeholder-product.png');
    return {
      _id: apiProduct._id || apiProduct.id,
      id: apiProduct._id || apiProduct.id,
      name: apiProduct.name,
      slug: apiProduct.slug,
      type: apiProduct.type || 'beverage',
      price,
      originPrice: originalPrice,
      sale,
      discount,
      new: isNew,
      sold: apiProduct.totalSold || (totalStock - availableStock),
      totalStock,
      availableStock,
      thumbImage: thumbImage.slice(0, 2),
      primaryImage: apiProduct.primaryImage,
      images: apiProduct.images?.map((img: any) => ({ url: img.url })),
      category: apiProduct.category,
      averageRating: apiProduct.stats?.averageRating || apiProduct.rate || 0,
      reviewCount: apiProduct.stats?.totalReviews || apiProduct.reviewCount || 0,
      badge: apiProduct.badge?.name ? { type: apiProduct.badge.type || 'default', name: apiProduct.badge.name, color: apiProduct.badge.color || '#10B981' } : sale ? { type: 'sale', name: `${discount}% OFF`, color: '#ef4444' } : isNew ? { type: 'new', name: 'NEW', color: '#10B981' } : undefined,
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
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (data.success && (data.data?.products || data.products)) {
        const productsData = data.data?.products || data.products;
        const mapped = productsData.map(mapProduct);
        setProducts(mapped);
        const initialSizes: Record<string, string> = {};
        mapped.forEach(p => { if (p.availableAt?.[0]?.sizes?.[0]?.size) initialSizes[p._id] = p.availableAt[0].sizes[0].size; });
        setSelectedSizes(initialSizes);
      } else {
        setError('No products found');
        setProducts([]);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(activeTab); }, [activeTab]);
  useEffect(() => { return () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current); }; }, []);

  const handleAddToCart = async (product: TabProduct) => {
    setAddingToCart(product._id);
    try {
      const vendorData = product.availableAt?.[0];
      const sizes = selectedSizes[product._id] ? vendorData?.sizes?.find(s => s.size === selectedSizes[product._id]) : vendorData?.sizes?.[0];
      const size = sizes?.size || 'Default';
      const sizeId = sizes?._id || '';
      const tenantName = vendorData?.tenant?.name || '';
      const tenantId = vendorData?.tenant?._id || '';
      const price = sizes?.pricing?.websitePrice || product.price;
      await addToCart({ _id: product._id, id: product._id, name: product.name, slug: product.slug, type: product.type, price, originPrice: product.originPrice, thumbImage: product.thumbImage, primaryImage: product.primaryImage, images: product.images } as any, size, '', tenantName, tenantId, 1, sizeId, vendorData?._id || '');
      showToastMessage(`${product.name} added to cart!`, 'success');
      openModalCart();
    } catch { showToastMessage('Failed to add to cart', 'error'); }
    finally { setAddingToCart(null); }
  };

  const handleRemoveFromCart = (product: TabProduct) => {
    const vendorData = product.availableAt?.[0];
    const sizes = selectedSizes[product._id] ? vendorData?.sizes?.find(s => s.size === selectedSizes[product._id]) : vendorData?.sizes?.[0];
    const size = sizes?.size || 'default';
    const tenantName = vendorData?.tenant?.name || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    removeFromCart(cartItemId);
    showToastMessage(`${product.name} removed from cart`, 'success');
  };

  const handleWishlistToggle = (product: TabProduct) => {
    setWishlistAdding(product._id);
    const inWishlist = wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
    if (inWishlist) { removeFromWishlist(product._id); showToastMessage('Removed from wishlist', 'success'); }
    else { addToWishlist({ id: product._id, _id: product._id, name: product.name, slug: product.slug, type: product.type, price: product.price, originPrice: product.originPrice, primaryImage: product.primaryImage || { url: product.thumbImage[0] || '/images/placeholder-product.png', alt: product.name }, images: product.images || [], thumbImage: product.thumbImage, sale: product.sale, createdAt: new Date().toISOString() } as any); showToastMessage('Added to wishlist!', 'success'); setTimeout(() => openModalWishlist(), 300); }
    setWishlistAdding(null);
  };

  const handleQuickView = (product: TabProduct) => {
    openQuickview({ _id: product._id, id: product._id, name: product.name, slug: product.slug, type: product.type, price: product.price, originPrice: product.originPrice, thumbImage: product.thumbImage, primaryImage: product.primaryImage, images: product.images, category: product.category, brand: product.category, availableAt: product.availableAt, createdAt: new Date().toISOString() } as any);
  };

  const handleCompare = (product: TabProduct) => {
    addToCompare({ _id: product._id, id: product._id, name: product.name, slug: product.slug, type: product.type, price: product.price, originPrice: product.originPrice, thumbImage: product.thumbImage, primaryImage: product.primaryImage, images: product.images } as any);
    showToastMessage('Added to compare!', 'success');
    openModalCompare();
  };

  const handleTabClick = (tabId: string) => {
    if (tabId === activeTab) return;
    setActiveTab(tabId);
    if (swiperRef.current) swiperRef.current.slideTo(0);
  };

  const formatPrice = (price: number) => '₦' + Math.round(price).toLocaleString();
  const getSoldPercentage = (p: TabProduct) => p.totalStock <= 0 ? 0 : Math.min(100, Math.round((p.sold / p.totalStock) * 100));
  const getStockStatus = (p: TabProduct) => { const pct = getSoldPercentage(p); if (pct >= 90) return { text: 'Almost Gone', color: 'text-red-500', bg: 'bg-red-500' }; if (pct >= 70) return { text: 'Selling Fast', color: 'text-orange-500', bg: 'bg-orange-500' }; if (pct >= 50) return { text: 'Limited Stock', color: 'text-yellow-500', bg: 'bg-yellow-500' }; return { text: 'In Stock', color: 'text-emerald-500', bg: 'bg-emerald-500' }; };
  const getMainBadge = (p: TabProduct) => { if (p.sale && p.discount > 0) return { text: `-${p.discount}%`, color: 'bg-gradient-to-r from-red-500 to-rose-500', glow: true }; if (p.new) return { text: 'NEW', color: 'bg-gradient-to-r from-emerald-500 to-teal-500', glow: false }; if (p.badge?.name) return { text: p.badge.name, color: '', glow: false }; return null; };
  const getVendorBg = (name: string) => VENDOR_PALETTE[vendorPaletteIndex(name)];
  const getCartInfo = (product: TabProduct) => {
    const vendorData = product.availableAt?.[0];
    const sizes = selectedSizes[product._id] ? vendorData?.sizes?.find(s => s.size === selectedSizes[product._id]) : vendorData?.sizes?.[0];
    const size = sizes?.size || 'default';
    const tenantName = vendorData?.tenant?.name || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return { inCart: !!cartItem, quantity: cartItem?.quantity || 0 };
  };
  const handleImageError = (productId: string) => {
    setImageErrors(prev => ({ ...prev, [productId]: true }));
  };
  const getPlaceholderEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      wine: '🍷',
      beer: '🍺',
      spirit: '🥃',
      whiskey: '🥃',
      rum: '🍹',
      vodka: '🍸',
      gin: '🥂',
      champagne: '🍾',
      liqueur: '🍸',
      cocktail: '🍹',
      'non-alcoholic': '🥤',
      'soft-drink': '🥤',
      default: '🍹'
    };
    return emojis[type?.toLowerCase()] || emojis.default;
  };

  if (loading) {
    return (
      <section className="py-16 md:py-24 bg-gradient-to-b from-white via-violet-50/20 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 text-violet-700 rounded-full text-sm font-bold mb-4"><Icon.PiStarFill size={16} className="text-amber-400" />Curated Selection</div>
            <div className="h-12 bg-gray-200 rounded-2xl w-72 mx-auto mb-4 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] bg-gray-200 rounded-2xl animate-pulse" />)}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 md:py-24 bg-gradient-to-b from-white to-gray-50">
        <div className="container mx-auto px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5"><Icon.PiWarning size={40} className="text-red-500" /></div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Oops!</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={() => fetchProducts(activeTab)} className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all shadow-lg"><Icon.PiArrowClockwise size={18} />Try Again</button>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-white via-violet-50/10 to-white overflow-hidden relative">
      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div initial={{ opacity: 0, y: 50, scale: 0.9, x: -20 }} animate={{ opacity: 1, y: 0, scale: 1, x: 0 }} exit={{ opacity: 0, y: 20, scale: 0.9 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} className={`fixed bottom-6 right-6 z-[100] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 ${toastType === 'success' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-gradient-to-r from-red-500 to-rose-500 text-white'}`}>
            {toastType === 'success' ? <Icon.PiCheckCircleFill size={22} /> : <Icon.PiWarningFill size={22} />}
            <span className="font-semibold text-sm">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-12">
          <motion.div initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold mb-5 bg-gradient-to-r ${activeTabConfig?.gradient || 'from-violet-500 to-purple-500'} text-white shadow-lg`}>
            <Icon.PiStarFill size={16} className="text-amber-300" />Curated Selection
          </motion.div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            {activeTab === 'best-sellers' && 'Best Selling'}
            {activeTab === 'on-sale' && <><span>On </span><span className="bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">Sale</span></>}
            {activeTab === 'new-arrivals' && <><span>New </span><span className="bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-transparent">Arrivals</span></>}
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">{activeTabConfig?.description}</p>
        </motion.div>

        {/* Tabs */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1.5 bg-gray-100/80 backdrop-blur-sm rounded-2xl shadow-inner">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => handleTabClick(tab.id)} className={`relative flex items-center gap-2.5 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${isActive ? 'text-white' : 'text-gray-500 hover:text-gray-700'}`}>
                  {isActive && <motion.div layoutId="activeTabBg" className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} rounded-xl shadow-lg`} />}
                  <span className="relative z-10">{tab.icon}</span>
                  <span className="relative z-10 hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Products */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}>
            {products.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5"><Icon.PiPackage size={36} className="text-gray-400" /></div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Products Found</h3>
              </motion.div>
            ) : (
              <Swiper onSwiper={(swiper) => { swiperRef.current = swiper; }} spaceBetween={16} slidesPerView={2} navigation={{ prevEl: '.tab-prev', nextEl: '.tab-next' }} pagination={{ clickable: true, dynamicBullets: true }} loop={products.length > 4} modules={[Navigation, Autoplay, Pagination]} autoplay={{ delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true }} breakpoints={{ 320: { slidesPerView: 1.3, spaceBetween: 12 }, 480: { slidesPerView: 2, spaceBetween: 16 }, 768: { slidesPerView: 3, spaceBetween: 20 }, 1024: { slidesPerView: 4, spaceBetween: 24 }, 1280: { slidesPerView: 4, spaceBetween: 28 } }} className="pb-12">
                {products.map((product, index) => {
                  const isAdding = addingToCart === product._id;
                  const isWishlistAdding = wishlistAdding === product._id;
                  const inWishlist = wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
                  const inCompare = isInCompare(product._id);
                  const cartInfo = getCartInfo(product);
                  const mainBadge = getMainBadge(product);
                  const stockStatus = getStockStatus(product);
                  const soldPercentage = getSoldPercentage(product);
                  const vendorData = product.availableAt?.[0];
                  const sizes = vendorData?.sizes || [];
                  const selectedSize = selectedSizes[product._id] || sizes[0]?.size;
                  const sizeData = selectedSize ? sizes.find(s => s.size === selectedSize) : sizes[0];
                  const price = sizeData?.pricing?.websitePrice || product.price;
                  const originalPrice = sizeData?.pricing?.originalWebsitePrice || sizeData?.pricing?.websitePrice || product.originPrice;
                  const hasMultipleSizes = sizes.length > 1;
                  const hasSecondImage = product.thumbImage.length > 1;
                  const isHovered = hoveredProduct === product._id;
                  const isOnSale = price < originalPrice;
                  const savings = isOnSale ? originalPrice - price : 0;
                  const vendorBg = vendorData?.tenant ? getVendorBg(vendorData.tenant.name) : '#6B7280';
                  const hasImageError = imageErrors[product._id];
                  const primaryImageUrl = product.thumbImage[0];
                  const secondaryImageUrl = product.thumbImage[1];
                  const emoji = getPlaceholderEmoji(product.type);

                  return (
                    <SwiperSlide key={product.id}>
                      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06, duration: 0.5 }} onMouseEnter={() => setHoveredProduct(product._id)} onMouseLeave={() => setHoveredProduct(null)} className="h-full">
                        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-2xl hover:shadow-violet-500/15 transition-all duration-500 h-full flex flex-col group relative">
                          
                          {/* Image Section */}
                          <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
                            <Link href={`/product/${product.slug}`} className="block w-full h-full">
                              <div className="relative w-full h-full">
                                {/* Image with Error Handling */}
                                {hasImageError || !primaryImageUrl ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-50">
                                    <span className="text-7xl mb-2 filter drop-shadow-lg">{emoji}</span>
                                    <span className="text-xs text-gray-400 font-medium">No image</span>
                                  </div>
                                ) : (
                                  <>
                                    {/* Primary Image */}
                                    <motion.div animate={{ scale: isHovered && hasSecondImage ? 1.08 : 1, opacity: isHovered && hasSecondImage ? 0 : 1 }} transition={{ duration: 0.5 }} className="absolute inset-0">
                                      <Image 
                                        src={primaryImageUrl} 
                                        alt={product.name} 
                                        fill 
                                        className="object-cover" 
                                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                        onError={() => handleImageError(product._id)}
                                      />
                                    </motion.div>
                                    
                                    {/* Secondary Image (hover) */}
                                    {hasSecondImage && !hasImageError && (
                                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: isHovered ? 1 : 0, scale: isHovered ? 1 : 1.05 }} transition={{ duration: 0.5 }} className="absolute inset-0">
                                        <Image 
                                          src={secondaryImageUrl} 
                                          alt={`${product.name} view 2`} 
                                          fill 
                                          className="object-cover"
                                          onError={() => handleImageError(product._id)}
                                        />
                                      </motion.div>
                                    )}
                                  </>
                                )}
                                
                                {/* Hover Overlay */}
                                <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
                                
                                {/* Product Name on Hover */}
                                <div className={`absolute bottom-4 left-4 right-4 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                                  <h3 className="text-white font-bold text-lg line-clamp-2 drop-shadow-lg">{product.name}</h3>
                                </div>
                              </div>
                            </Link>

                            {/* Badges - Top Left */}
                            <div className="absolute top-3 left-3 flex flex-col gap-2">
                              {mainBadge && (
                                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className={`relative px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-lg ${mainBadge.color} ${mainBadge.glow ? 'shadow-red-500/50 animate-pulse' : ''}`}>
                                  {mainBadge.text}
                                  {mainBadge.glow && <div className="absolute inset-0 rounded-xl bg-red-500/50 blur-md -z-10" />}
                                </motion.div>
                              )}
                              {product.availableAt && product.availableAt.length > 1 && (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg">
                                  <Icon.PiStorefront size={14} className="text-violet-600" />
                                  <span className="text-xs font-bold text-gray-800">{product.availableAt.length} sellers</span>
                                </div>
                              )}
                            </div>

                            {/* Action Buttons - Top Right */}
                            <div className="absolute top-3 right-3 flex flex-col gap-2">
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleWishlistToggle(product)} disabled={isWishlistAdding} className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg transition-all backdrop-blur-md ${isWishlistAdding ? 'bg-gray-400' : inWishlist ? 'bg-red-500 text-white' : 'bg-white/90 text-gray-600 hover:bg-red-500 hover:text-white'}`}>
                                {isWishlistAdding ? <Icon.PiSpinner size={18} className="animate-spin" /> : inWishlist ? <Icon.PiHeartFill size={18} /> : <Icon.PiHeart size={18} />}
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleQuickView(product)} className="w-10 h-10 rounded-xl bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center text-gray-600 hover:bg-violet-500 hover:text-white transition-all">
                                <Icon.PiEye size={18} />
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => handleCompare(product)} className={`w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-all backdrop-blur-md ${inCompare ? 'bg-amber-500 text-white' : 'bg-white/90 text-gray-600 hover:bg-amber-500 hover:text-white'}`}>
                                <Icon.PiScales size={18} />
                              </motion.button>
                            </div>

                            {/* Quick Size Selector - Bottom */}
                            {hasMultipleSizes && (
                              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: isHovered ? 0 : 20, opacity: isHovered ? 1 : 0 }} transition={{ duration: 0.3 }} className="absolute bottom-20 left-3 right-3">
                                <div className="flex flex-wrap gap-1.5 justify-center">
                                  {sizes.slice(0, 4).map((size) => (
                                    <button key={size._id} onClick={(e) => { e.preventDefault(); setSelectedSizes(prev => ({ ...prev, [product._id]: size.size })); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedSize === size.size ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/50' : 'bg-white/95 backdrop-blur-md text-gray-700 hover:bg-violet-100'}`}>
                                      {size.size}
                                    </button>
                                  ))}
                                </div>
                              </motion.div>
                            )}

                            {/* Add to Cart Button */}
                            <div className="absolute bottom-0 left-0 right-0">
                              <button onClick={(e) => { e.preventDefault(); cartInfo.inCart ? handleRemoveFromCart(product) : handleAddToCart(product); }} disabled={isAdding} className={`w-full py-4 px-4 font-bold text-sm flex items-center justify-center gap-2 transition-all ${isAdding ? 'bg-violet-500 text-white' : cartInfo.inCart ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                                {isAdding ? <><Icon.PiSpinner size={18} className="animate-spin" />Adding...</> : cartInfo.inCart ? <><Icon.PiTrash size={18} />Remove from Cart ({cartInfo.quantity})</> : <><Icon.PiShoppingCartSimple size={18} />Add to Cart</>}
                              </button>
                            </div>
                          </div>

                          {/* Content Section */}
                          <div className="p-4 flex-1 flex flex-col bg-white">
                            {/* Vendor Badge */}
                            {vendorData?.tenant && (
                              <div className="inline-flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-md" style={{ backgroundColor: vendorBg }}>
                                  {getInitials(vendorData.tenant.name).charAt(0)}
                                </div>
                                <span className="text-xs font-semibold text-gray-600 truncate">{vendorData.tenant.name}</span>
                              </div>
                            )}
                            
                            {/* Product Name */}
                            <Link href={`/product/${product.slug}`} className="block flex-1">
                              <h3 className="font-bold text-gray-900 text-sm sm:text-base line-clamp-2 hover:text-violet-600 transition-colors mb-2">{product.name}</h3>
                            </Link>

                            {/* Rating */}
                            {product.averageRating > 0 && (
                              <div className="flex items-center gap-2 mb-3">
                                <div className="flex items-center">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <Icon.PiStarFill key={i} size={12} className={i < Math.floor(product.averageRating) ? 'text-amber-400' : 'text-gray-200'} />
                                  ))}
                                </div>
                                <span className="text-xs text-gray-500 font-medium">({product.reviewCount})</span>
                              </div>
                            )}

                            {/* Price Section */}
                            <div className="flex items-baseline gap-2 mb-3">
                              <span className={`text-xl font-black ${isOnSale ? 'text-violet-600' : 'text-gray-900'}`}>{formatPrice(price)}</span>
                              {isOnSale && (
                                <>
                                  <span className="text-sm text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold">Save {formatPrice(savings)}</span>
                                </>
                              )}
                            </div>

                            {/* Info Badges */}
                            <div className="flex flex-wrap gap-2 mb-3">
                              {product.abv && <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-semibold"><Icon.PiWine size={12} />{product.abv}% ABV</span>}
                              {product.defaultSize && <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-semibold"><Icon.PiDrop size={12} />{product.defaultSize}</span>}
                            </div>

                            {/* Stock Progress */}
                            <div className="mt-auto pt-3 border-t border-gray-100">
                              <div className="flex items-center justify-between text-xs mb-2">
                                <span className={`font-bold ${stockStatus.color}`}>{stockStatus.text}</span>
                                <span className="text-gray-400">{soldPercentage}% sold</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div initial={{ width: 0 }} animate={{ width: `${soldPercentage}%` }} transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }} className={`h-full rounded-full ${stockStatus.bg}`} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </SwiperSlide>
                  );
                })}
              </Swiper>
            )}
            {products.length > 4 && (
              <>
                <button className="tab-prev absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-gray-600 hover:text-violet-600 transition-all hidden md:flex"><Icon.PiCaretLeft size={22} /></button>
                <button className="tab-next absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-12 h-12 bg-white rounded-full shadow-xl flex items-center justify-center text-gray-600 hover:text-violet-600 transition-all hidden md:flex"><Icon.PiCaretRight size={22} /></button>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* View All */}
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }} className="text-center mt-10">
          <Link href="/shop"><button className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-bold rounded-full hover:from-gray-800 hover:to-gray-700 transition-all shadow-xl"><Icon.PiArrowRight size={18} />View All Products</button></Link>
        </motion.div>
      </div>
      <div className="absolute -top-20 -right-20 w-96 h-96 bg-gradient-to-br from-violet-200/30 to-purple-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-96 h-96 bg-gradient-to-tr from-rose-200/20 to-pink-200/20 rounded-full blur-3xl pointer-events-none" />
    </section>
  );
};

export default TabFeatures;
