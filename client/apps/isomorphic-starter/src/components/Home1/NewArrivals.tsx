'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import * as Icon from 'react-icons/pi';

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  country?: string;
}

interface ProductSize {
  _id: string;
  size: string;
  volumeMl?: number;
  stock: number;
  availability?: string;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
  };
}

interface AvailableAtEntry {
  _id?: string;
  tenant?: Tenant;
  sizes?: ProductSize[];
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
}

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
  abv?: number;
  originCountry?: string;
  region?: string;
  volumeMl?: number;
  availableAt?: AvailableAtEntry[];
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
  sizes?: ProductSize[];
  defaultSize?: string;
  abv?: number;
  originCountry?: string;
  region?: string;
  volumeMl?: number;
  availableAt?: AvailableAtEntry[];
}

interface NewArrivalsProps {
  products?: Product[];
  limit?: number;
  title?: string;
  subtitle?: string;
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
  const sizes = availableAt?.sizes as ProductSize[] | undefined;
  const defaultSize = sizes?.find(s => s.isDefault)?.size || sizes?.[0]?.size || apiProduct.volumeMl ? `${apiProduct.volumeMl}ml` : undefined;
  
  const websitePrice = pricing?.websitePrice || apiProduct.priceRange?.min || 0;
  const compareAtPrice = pricing?.compareAtPrice || pricing?.originalWebsitePrice || apiProduct.priceRange?.max || websitePrice;
  
  const isOnSaleFromApi = availableAt?.isOnSale || (apiProduct.discount?.value && apiProduct.discount.value > 0);
  const saleDiscountValue = availableAt?.saleDiscountValue || apiProduct.discount?.value || 0;
  
  const sale = isOnSaleFromApi && saleDiscountValue > 0;
  const discount = sale ? Math.round(saleDiscountValue) : 0;
  const price = sale ? Math.round(compareAtPrice * (1 - discount / 100)) : websitePrice;
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
    ? { type: apiProduct.badge.type || 'default', name: apiProduct.badge.name, color: apiProduct.badge.color || '#10B981' }
    : sale ? { type: 'sale', name: `${discount}% OFF`, color: '#ef4444' }
    : isNew ? { type: 'new', name: 'NEW', color: '#10B981' }
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
    sizes,
    defaultSize,
    abv: apiProduct.abv,
    originCountry: apiProduct.originCountry,
    region: apiProduct.region,
    volumeMl: apiProduct.volumeMl,
    availableAt: apiProduct.availableAt,
  };
};

const NewArrivals: React.FC<NewArrivalsProps> = ({
  limit = 8,
  title = "New Arrivals",
  subtitle = "Fresh additions to our collection"
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });
  
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -30]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 30]);
  const springY1 = useSpring(y1, { stiffness: 100, damping: 30 });
  const springY2 = useSpring(y2, { stiffness: 100, damping: 30 });

  const { addToCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openQuickview } = useModalQuickviewContext();
  const { openModalWishlist } = useModalWishlistContext();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchNewArrivals();
  }, [limit]);

  const fetchNewArrivals = async () => {
    try {
      setLoading(true);
      setError(null);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${API_URL}/api/products?sort=newest&limit=${limit}`);
      
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
        setError('No new arrivals found');
      }
    } catch (error) {
      console.error('Error fetching new arrivals:', error);
      setError(error instanceof Error ? error.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

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
      return { type: 'new' as const, text: 'NEW', color: 'bg-green-500' };
    }
    if (product.badge && product.badge.name) {
      return { type: 'badge' as const, text: product.badge.name, color: '' };
    }
    return null;
  };

  const isProductInCart = useCallback((product: Product) => {
    const availableAt = product.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = product.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    return cartState.cartArray.some(item => item.cartItemId === cartItemId);
  }, [cartState.cartArray]);

  const getCartQuantity = useCallback((product: Product) => {
    const availableAt = product.availableAt?.[0];
    const tenantName = availableAt?.tenant?.name || 'default';
    const size = product.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return cartItem?.quantity || 0;
  }, [cartState.cartArray]);

  const isProductInWishlist = useCallback((product: Product) => {
    return wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
  }, [wishlistState.wishlistArray]);

  const handleAddToCart = async (product: Product) => {
    setAddingToCart(product._id);
    try {
      const availableAt = product.availableAt?.[0];
      const sizeData = product.sizes?.[0];
      const size = sizeData?.size || product.defaultSize || 'Default';
      const tenantName = availableAt?.tenant?.name || '';
      const tenantId = availableAt?.tenant?._id || '';
      const cartItemId = `${product._id}-${size}-${tenantName || 'default'}-default`;
      
      const existingItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
      const wasAlreadyInCart = !!existingItem;
      
      await addToCart(
        { ...product, id: product._id } as any,
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

  const handleWishlistToggle = (product: Product) => {
    setWishlistAdding(product._id);
    try {
      const inWishlist = isProductInWishlist(product);
      if (inWishlist) {
        removeFromWishlist(product._id);
        showToast('Removed from wishlist', 'success');
      } else {
        addToWishlist({ ...product, id: product._id } as any);
        showToast('Added to wishlist!', 'success');
        setTimeout(() => openModalWishlist(), 300);
      }
    } catch {
      showToast('Failed to update wishlist', 'error');
    } finally {
      setWishlistAdding(null);
    }
  };

  const handleQuickView = (product: Product) => {
    openQuickview({ ...product, id: product._id, quantityPurchase: 1 } as any);
  };

  if (loading) {
    return (
      <section ref={sectionRef} className="py-16 md:py-24 bg-gradient-to-b from-green-50 via-white to-gray-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 rounded-full text-sm font-medium text-green-700 mb-4">
              <Icon.PiSparkle size={16} className="text-green-600" />
              Fresh Arrivals
            </div>
            <div className="h-10 bg-gray-200 rounded-full w-56 mx-auto shimmer" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-gray-200 rounded-2xl shimmer" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section ref={sectionRef} className="py-16 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
            <Icon.PiWarning size={40} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Oops!</h3>
          <p className="text-gray-600 mb-5">{error}</p>
          <button
            onClick={fetchNewArrivals}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all"
          >
            <Icon.PiArrowClockwise size={18} />
            Try Again
          </button>
        </div>
      </section>
    );
  }

  if (products.length === 0) return null;

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-gradient-to-b from-gray-50 via-white to-gray-50 overflow-hidden relative">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div style={{ y: springY1 }} className="absolute -top-20 -right-20 w-[500px] h-[500px] bg-gradient-to-br from-green-100/50 to-emerald-100/50 rounded-full blur-3xl" />
        <motion.div style={{ y: springY2 }} className="absolute -bottom-20 -left-20 w-[500px] h-[500px] bg-gradient-to-br from-blue-100/50 to-purple-100/50 rounded-full blur-3xl" />
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
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-100 rounded-full mb-4"
          >
            <Icon.PiSparkle size={16} className="text-green-600" />
            <span className="text-sm font-medium text-green-700">Fresh Arrivals</span>
          </motion.div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">{title}</h2>
          <p className="text-gray-500 text-base md:text-lg max-w-2xl mx-auto">{subtitle}</p>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
          {products.map((product, index) => {
            const isHovered = hoveredProduct === product._id;
            const isAdding = addingToCart === product._id;
            const isWishlistAdding = wishlistAdding === product._id;
            const inWishlist = isProductInWishlist(product);
            const inCart = isProductInCart(product);
            const cartQty = getCartQuantity(product);
            const hasSecondImage = (product.thumbImage?.length || 0) > 1;
            const mainBadge = getMainBadge(product);
            const stockStatus = getStockStatus(product);
            const soldPercentage = getSoldPercentage(product);

            return (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06, duration: 0.5 }}
                onMouseEnter={() => setHoveredProduct(product._id)}
                onMouseLeave={() => setHoveredProduct(null)}
                className="group"
              >
                <motion.div 
                  whileHover={{ y: -8 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300"
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
                          priority={index < 4}
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
                        whileHover={{ scale: isWishlistAdding ? 1 : 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleWishlistToggle(product)}
                        disabled={isWishlistAdding}
                        className={`w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-colors ${
                          isWishlistAdding 
                            ? 'bg-gray-400' 
                            : inWishlist 
                              ? 'bg-red-500 text-white' 
                              : 'bg-white text-gray-600 hover:bg-red-50 hover:text-red-500'
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
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleQuickView(product)}
                        className="w-9 h-9 rounded-full bg-white text-gray-600 flex items-center justify-center shadow-md hover:bg-green-600 hover:text-white transition-colors"
                      >
                        <Icon.PiEye size={16} />
                      </motion.button>
                    </motion.div>

                    <motion.div 
                      className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
                    >
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={isAdding || inCart}
                        className={`w-full py-2.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
                          isAdding 
                            ? 'bg-green-500 text-white'
                            : inCart 
                              ? 'bg-green-100 text-green-700 border-2 border-green-300'
                              : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {isAdding ? (
                          <>
                            <motion.div 
                              initial={{ scale: 0 }} 
                              animate={{ scale: 1 }} 
                              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                            >
                              <Icon.PiCheck size={16} />
                            </motion.div>
                            Added!
                          </>
                        ) : inCart ? (
                          <>
                            <Icon.PiShoppingCart size={16} />
                            ({cartQty})
                          </>
                        ) : (
                          <>
                            <Icon.PiShoppingCart size={16} />
                            Add to Cart
                          </>
                        )}
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
                      <h3 className="font-semibold text-gray-900 text-sm md:text-base line-clamp-2 mb-2 hover:text-green-600 transition-colors">
                        {product.name}
                      </h3>
                    </Link>

                    {product.availableAt?.[0]?.tenant && (
                      <Link href={`/shop?tenant=${product.availableAt[0].tenant.slug}`} className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition-colors mb-2">
                        <Icon.PiStorefront size={12} />
                        <span>{product.availableAt[0].tenant.name}</span>
                      </Link>
                    )}

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
                                whileInView={{ scale: 1, rotate: 0 }}
                                viewport={{ once: true }}
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
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"
                        >
                          {product.averageRating.toFixed(1)}
                        </motion.span>
                        <motion.span 
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          viewport={{ once: true }}
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

                    {(product.defaultSize || product.abv || product.originCountry) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {product.defaultSize && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                            <Icon.PiFlask size={10} />
                            {product.defaultSize}
                          </span>
                        )}
                        {product.abv && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 rounded text-xs text-green-600">
                            <Icon.PiWine size={10} />
                            {product.abv}%
                          </span>
                        )}
                        {product.originCountry && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 rounded text-xs text-blue-600">
                            <Icon.PiGlobe size={10} />
                            {product.originCountry}
                          </span>
                        )}
                      </div>
                    )}

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
                          transition={{ duration: 0.8, delay: index * 0.1 }}
                          className={`h-full rounded-full ${stockStatus.bg}`}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center mt-12"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/shop?sort=newest')}
            className="inline-flex items-center gap-2.5 px-8 py-3.5 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
          >
            View All New Arrivals
            <Icon.PiArrowRight size={18} />
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
};

export default NewArrivals;
