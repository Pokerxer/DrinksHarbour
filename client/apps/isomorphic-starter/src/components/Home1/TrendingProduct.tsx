'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import type { Swiper as SwiperType } from 'swiper';
import 'swiper/css';
import 'swiper/css/navigation';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import * as Icon from 'react-icons/pi';

interface ApiProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  type: string;
  primaryImage?: { url: string; alt?: string };
  images?: Array<{ url: string; alt?: string; isPrimary?: boolean }>;
  priceRange?: { min: number; max: number; display?: string };
  discount?: { value?: number; type?: string; label?: string; originalPrice?: number };
  badge?: { type?: string; name?: string; color?: string };
  category?: { name: string; slug: string };
  averageRating?: number;
  reviewCount?: number;
  totalSold?: number;
  stockInfo?: { totalStock?: number; availableStock?: number };
  createdAt?: string;
  isFeatured?: boolean;
  availableAt?: Array<{
    _id?: string;
    pricing?: {
      websitePrice?: number;
      originalWebsitePrice?: number;
      compareAtPrice?: number;
      displayPrice?: string;
      formattedPrice?: string;
    };
    isOnSale?: boolean;
    saleDiscountValue?: number;
    saleType?: string;
    saleStartDate?: string;
    saleEndDate?: string;
    totalStock?: number;
    availableStock?: number;
  }>;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  price: number;
  originPrice: number;
  sale: boolean;
  discount: number;
  thumbImage: string[];
  primaryImage?: { url: string };
  images?: Array<{ url: string }>;
  badge?: { type: string; name: string; color: string };
  category?: { name: string };
  averageRating: number;
  reviewCount: number;
  isNew: boolean;
  totalSold: number;
  totalStock: number;
  availableStock: number;
  isOnSale: boolean;
}

interface TrendingProductProps {
  limit?: number;
}

const mapApiProductToProduct = (apiProduct: ApiProduct): Product => {
  const thumbImage: string[] = [];
  
  if (apiProduct.primaryImage?.url) {
    thumbImage.push(apiProduct.primaryImage.url);
  }
  
  if (apiProduct.images && apiProduct.images.length > 0) {
    const primaryImageUrl = apiProduct.primaryImage?.url;
    apiProduct.images.forEach((img) => {
      if (img.url && img.url !== primaryImageUrl && !thumbImage.includes(img.url)) {
        thumbImage.push(img.url);
      }
    });
  }

  if (thumbImage.length === 0) {
    thumbImage.push('/images/placeholder-product.png');
  }

  const availableAt = apiProduct.availableAt?.[0];
  const pricing = availableAt?.pricing;
  
  const websitePrice = pricing?.websitePrice || apiProduct.priceRange?.min || 0;
  const compareAtPrice = pricing?.compareAtPrice || pricing?.originalWebsitePrice || apiProduct.priceRange?.max || websitePrice;
  const originalWebsitePrice = pricing?.originalWebsitePrice || apiProduct.priceRange?.max || compareAtPrice;
  
  const isOnSaleFromApi = availableAt?.isOnSale || (apiProduct.discount?.value && apiProduct.discount.value > 0);
  const saleDiscountValue = availableAt?.saleDiscountValue || apiProduct.discount?.value || 0;
  
  const sale = isOnSaleFromApi && saleDiscountValue > 0;
  
  const discount = sale 
    ? Math.round(saleDiscountValue)
    : 0;
  
  const price = sale 
    ? Math.round(compareAtPrice * (1 - discount / 100))
    : websitePrice;
  
  const originPrice = compareAtPrice;

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

  const badge = apiProduct.badge?.name
    ? {
        type: apiProduct.badge.type || 'default',
        name: apiProduct.badge.name,
        color: apiProduct.badge.color || '#10B981',
      }
    : sale
      ? { type: 'sale', name: `${discount}% OFF`, color: '#ef4444' }
      : isNew
        ? { type: 'new', name: 'NEW', color: '#10B981' }
        : undefined;

  return {
    _id: apiProduct._id,
    slug: apiProduct.slug,
    name: apiProduct.name,
    price,
    originPrice,
    sale,
    discount,
    thumbImage,
    primaryImage: apiProduct.primaryImage,
    images: apiProduct.images?.map(img => ({ url: img.url })),
    badge,
    category: apiProduct.category,
    averageRating: apiProduct.averageRating || 0,
    reviewCount: apiProduct.reviewCount || 0,
    isNew,
    totalSold,
    totalStock,
    availableStock,
    isOnSale: sale,
  };
};

const TrendingProduct: React.FC<TrendingProductProps> = ({ limit = 8 }) => {
  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openQuickview } = useModalQuickviewContext();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [swiper, setSwiper] = useState<SwiperType | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.3, 1, 1, 0.3]);

  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const backgroundYSpring = useSpring(backgroundY, springConfig);

  useEffect(() => {
    const fetchTrendingProducts = async () => {
      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await fetch(`${API_URL}/api/products/trending?limit=${limit}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }
        
        const data = await response.json();

        if (data.success && data.data?.products) {
          const mappedProducts = data.data.products.map(mapApiProductToProduct);
          setProducts(mappedProducts);
        } else if (data.products) {
          const mappedProducts = data.products.map(mapApiProductToProduct);
          setProducts(mappedProducts);
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error('Error fetching trending products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load trending products');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTrendingProducts();
  }, [limit]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getProductImage = (product: Product, index: number = 0) => {
    if (product.thumbImage?.[index]) return product.thumbImage[index];
    if (product.primaryImage?.url) return product.primaryImage.url;
    return '/images/placeholder-product.png';
  };

  const formatPrice = (price: number) => {
    return '₦' + Math.round(price).toLocaleString();
  };

  const getSoldPercentage = (product: Product) => {
    if (product.totalStock <= 0) return 0;
    const sold = product.totalSold;
    return Math.min(100, Math.round((sold / product.totalStock) * 100));
  };

  const getStockStatus = (product: Product) => {
    const percentage = getSoldPercentage(product);
    if (percentage >= 90) return { text: 'Almost Gone', color: 'text-red-500', bg: 'bg-red-500' };
    if (percentage >= 70) return { text: 'Selling Fast', color: 'text-orange-500', bg: 'bg-orange-500' };
    if (percentage >= 50) return { text: 'Limited Stock', color: 'text-yellow-500', bg: 'bg-yellow-500' };
    return { text: 'In Stock', color: 'text-green-500', bg: 'bg-green-500' };
  };

  const getMainBadge = (product: Product) => {
    if (product.sale && product.discount > 0) {
      return { type: 'sale' as const, text: `-${product.discount}%`, color: 'bg-red-500' };
    }
    if (product.isNew) {
      return { type: 'new' as const, text: 'TRENDING', color: 'bg-gradient-to-r from-amber-500 to-orange-500' };
    }
    if (product.badge && product.badge.name) {
      return { type: 'badge' as const, text: product.badge.name, color: '' };
    }
    return null;
  };

  const handleAddToCart = async (product: Product) => {
    setAddingToCart(product._id);
    try {
      addToCart({
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        originPrice: product.originPrice,
        sale: product.sale,
        thumbImage: product.thumbImage,
        quantityPurchase: 1
      } as any);
      await new Promise(resolve => setTimeout(resolve, 500));
      showToast(`${product.name} added to cart!`, 'success');
      openModalCart();
    } catch (error) {
      showToast('Failed to add to cart', 'error');
    } finally {
      setAddingToCart(null);
    }
  };

  const handleWishlistToggle = (product: Product) => {
    const isInWishlist = wishlistState.wishlistArray.some(item => item.id === product._id);
    if (isInWishlist) {
      removeFromWishlist(product._id);
      showToast('Removed from wishlist', 'success');
    } else {
      addToWishlist({
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        thumbImage: product.thumbImage
      } as any);
      showToast('Added to wishlist!', 'success');
    }
  };

  const handleQuickView = (product: Product) => {
    openQuickview({
      _id: product._id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      originPrice: product.originPrice,
      sale: product.sale,
      thumbImage: product.thumbImage,
      quantityPurchase: 1
    } as any);
  };

  const goNext = () => {
    if (swiper) swiper.slideNext();
  };

  const goPrev = () => {
    if (swiper) swiper.slidePrev();
  };

  if (loading) {
    return (
      <section className="trending-block py-16 sm:py-20 bg-gradient-to-b from-white via-amber-50/30 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-sm font-medium text-amber-700 mb-4">
              <Icon.PiFireFill size={16} className="text-amber-500" />
              Hot This Week
            </div>
            <div className="h-10 bg-gray-200 rounded w-48 mx-auto shimmer" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-gray-200 rounded-2xl shimmer" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="trending-block py-16 sm:py-24 relative overflow-hidden bg-gradient-to-b from-white via-amber-50/30 to-white">
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-white via-amber-50/30 to-white"
        style={{ y: backgroundYSpring, opacity }}
      />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-10 w-72 h-72 bg-amber-200/20 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 right-10 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

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
        <motion.div
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="text-center sm:text-left">
            <motion.div
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full text-sm font-medium text-amber-800 mb-4 shadow-sm"
              whileHover={{ scale: 1.05, y: -2 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Icon.PiFireFill size={16} className="text-amber-600" />
              </motion.div>
              <span>Hot This Week</span>
            </motion.div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-3">
              Trending{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600">
                Products
              </span>
            </h2>
            <p className="text-gray-500 text-lg">Discover what's popular this week</p>
          </div>
          
          <div className="flex items-center gap-3 justify-center sm:justify-end">
            <motion.button
              onClick={goPrev}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center text-gray-600 shadow-md hover:border-amber-500 hover:text-amber-600 transition-all duration-300"
            >
              <Icon.PiArrowLeft size={20} />
            </motion.button>
            <motion.button
              onClick={goNext}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-white border-2 border-gray-200 flex items-center justify-center text-gray-600 shadow-md hover:border-amber-500 hover:text-amber-600 transition-all duration-300"
            >
              <Icon.PiArrowRight size={20} />
            </motion.button>
          </div>
        </motion.div>

        <AnimatePresence>
          {error && (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Icon.PiWarningCircle size={48} className="mx-auto text-red-400 mb-4" />
              <p className="text-gray-500">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {products.length > 0 ? (
            <motion.div
              key="products"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="hidden lg:block">
                <Swiper
                  modules={[Autoplay, Navigation]}
                  onSwiper={setSwiper}
                  slidesPerView={4}
                  spaceBetween={24}
                  loop={products.length > 4}
                  autoplay={{ delay: 5000, disableOnInteraction: false }}
                  className="h-full !pb-4"
                >
                  {products.map((product, index) => (
                    <SwiperSlide key={product._id}>
                      <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.5 }}
                        className="h-full"
                      >
                        <ProductCard 
                          product={product}
                          isHovered={hoveredProduct === product._id}
                          setHovered={setHoveredProduct}
                          addingToCart={addingToCart}
                          setAddingToCart={setAddingToCart}
                          inWishlist={wishlistState.wishlistArray.some(item => item.id === product._id)}
                          onWishlistToggle={handleWishlistToggle}
                          onQuickView={handleQuickView}
                          onAddToCart={handleAddToCart}
                          getProductImage={getProductImage}
                          formatPrice={formatPrice}
                          getSoldPercentage={getSoldPercentage}
                          getStockStatus={getStockStatus}
                          getMainBadge={getMainBadge}
                          imageLoaded={imageLoaded}
                          setImageLoaded={setImageLoaded}
                        />
                      </motion.div>
                    </SwiperSlide>
                  ))}
                </Swiper>
              </div>

              <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
                {products.slice(0, limit).map((product, index) => (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.5 }}
                  >
                    <ProductCard 
                      product={product}
                      isHovered={hoveredProduct === product._id}
                      setHovered={setHoveredProduct}
                      addingToCart={addingToCart}
                      setAddingToCart={setAddingToCart}
                      inWishlist={wishlistState.wishlistArray.some(item => item.id === product._id)}
                      onWishlistToggle={handleWishlistToggle}
                      onQuickView={handleQuickView}
                      onAddToCart={handleAddToCart}
                      getProductImage={getProductImage}
                      formatPrice={formatPrice}
                      getSoldPercentage={getSoldPercentage}
                      getStockStatus={getStockStatus}
                      getMainBadge={getMainBadge}
                      imageLoaded={imageLoaded}
                      setImageLoaded={setImageLoaded}
                    />
                  </motion.div>
                ))}
              </div>

              <motion.div
                className="text-center mt-16"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ delay: 0.6 }}
              >
                <Link
                  href="/shop?sort=trending"
                  className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-2xl font-semibold shadow-lg shadow-amber-600/30 hover:shadow-xl hover:shadow-amber-600/40 transition-all duration-300"
                >
                  <span>View All Trending</span>
                  <motion.span
                    className="inline-block"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <Icon.PiArrowRight size={20} />
                  </motion.span>
                </Link>
              </motion.div>
            </motion.div>
          ) : (
            !error && (
              <motion.div
                key="empty"
                className="text-center py-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Icon.PiPackage size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No trending products found</p>
              </motion.div>
            )
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

interface ProductCardProps {
  product: Product;
  isHovered: boolean;
  setHovered: (id: string | null) => void;
  addingToCart: string | null;
  setAddingToCart: (id: string | null) => void;
  inWishlist: boolean;
  onWishlistToggle: (product: Product) => void;
  onQuickView: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  getProductImage: (product: Product, index?: number) => string;
  formatPrice: (price: number) => string;
  getSoldPercentage: (product: Product) => number;
  getStockStatus: (product: Product) => { text: string; color: string; bg: string };
  getMainBadge: (product: Product) => { type: string; text: string; color: string } | null;
  imageLoaded: Record<string, boolean>;
  setImageLoaded: (loaded: Record<string, boolean>) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isHovered,
  setHovered,
  addingToCart,
  inWishlist,
  onWishlistToggle,
  onQuickView,
  onAddToCart,
  getProductImage,
  formatPrice,
  getSoldPercentage,
  getStockStatus,
  getMainBadge,
  imageLoaded,
  setImageLoaded,
}) => {
  const hasSecondImage = (product.thumbImage?.length || 0) > 1;
  const mainBadge = getMainBadge(product);
  const stockStatus = getStockStatus(product);
  const soldPercentage = getSoldPercentage(product);

  return (
    <motion.div
      onMouseEnter={() => setHovered(product._id)}
      onMouseLeave={() => setHovered(null)}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 h-full"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-50">
        {!imageLoaded[product._id] && (
          <motion.div 
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200 animate-pulse z-10"
          />
        )}
        
        <Link href={`/product/${product.slug}`}>
          <motion.div
            animate={{ scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.4 }}
            className="relative w-full h-full"
          >
            <Image
              src={getProductImage(product, 0)}
              alt={product.name}
              fill
              className={`object-cover transition-all duration-500 ${hasSecondImage && isHovered ? 'opacity-0 scale-110' : 'opacity-100'}`}
              onLoad={() => setImageLoaded(prev => ({ ...prev, [product._id]: true }))}
              priority
            />
            
            {hasSecondImage && (
              <Image
                src={getProductImage(product, 1)}
                alt={`${product.name} - 2`}
                fill
                className={`object-cover absolute inset-0 transition-all duration-500 ${isHovered ? 'opacity-100 scale-110' : 'opacity-0'}`}
              />
            )}
          </motion.div>
        </Link>

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

        <motion.div 
          className={`absolute top-3 right-3 flex gap-2 transition-all duration-300 ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'}`}
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onWishlistToggle(product)}
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors ${
              inWishlist ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            {inWishlist ? <Icon.PiHeartFill size={16} /> : <Icon.PiHeart size={16} />}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onQuickView(product)}
            className="w-9 h-9 rounded-full bg-white text-gray-600 flex items-center justify-center shadow-md hover:bg-gray-900 hover:text-white transition-colors"
          >
            <Icon.PiEye size={16} />
          </motion.button>
        </motion.div>

        <motion.div 
          className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
        >
          <button
            onClick={() => onAddToCart(product)}
            disabled={addingToCart === product._id}
            className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 ${
              addingToCart === product._id ? 'bg-gray-100 text-gray-400' : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}
          >
            {addingToCart === product._id ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Icon.PiSpinner size={16} />
              </motion.div>
            ) : (
              <Icon.PiShoppingCart size={16} />
            )}
            {addingToCart === product._id ? 'Adding...' : 'Add to Cart'}
          </button>
        </motion.div>
      </div>

      <div className="p-4">
        {product.category && (
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block">
            {product.category.name}
          </span>
        )}
        
        <Link href={`/product/${product.slug}`}>
          <h3 className="font-semibold text-gray-900 text-sm md:text-base line-clamp-2 mb-2 hover:text-amber-600 transition-colors">
            {product.name}
          </h3>
        </Link>

        {product.averageRating > 0 && (
          <div className="flex items-center gap-2 mb-2.5">
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const rating = product.averageRating;
                const filled = i < Math.floor(rating);
                const partial = !filled && i < rating;
                return (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 200, damping: 15 }}
                  >
                    <Icon.PiStarFill
                      size={12}
                      className={filled || partial ? 'text-yellow-400' : 'text-gray-200'}
                    />
                  </motion.div>
                );
              })}
            </div>
            <motion.span 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"
            >
              {product.averageRating.toFixed(1)}
            </motion.span>
            <motion.span 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-gray-400"
            >
              ({product.reviewCount})
            </motion.span>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-bold text-gray-900">
            {formatPrice(product.price)}
          </span>
          {product.sale && product.originPrice > product.price && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(product.originPrice)}
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className={`font-medium ${stockStatus.color}`}>{stockStatus.text}</span>
            <span className="text-gray-400">{soldPercentage}% sold</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              whileInView={{ width: `${soldPercentage}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full ${stockStatus.bg}`}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default TrendingProduct;
