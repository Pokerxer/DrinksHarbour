'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import * as Icon from 'react-icons/pi';

interface Vendor {
  _id: string;
  name: string;
  slug: string;
  primaryColor?: string;
  city?: string;
  state?: string;
  country?: string;
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
  sizeVariants?: string[];
  availableAt?: Array<{
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
  }>;
}

interface Tenant {
  _id: string;
  name: string;
  slug: string;
  primaryColor?: string;
  city?: string;
  state?: string;
  country?: string;
}

interface ProductSize {
  _id: string;
  size: string;
  volumeMl?: number;
  stock: number;
  availability: string;
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
    displayPrice?: string;
    currencySymbol?: string;
  };
  discount?: { label?: string; percentage?: number };
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
}

interface AvailableAtEntry {
  _id: string;
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

interface BestSellersProps {
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
  const tenant = availableAt?.tenant;
  const sizes = availableAt?.sizes as ProductSize[] | undefined;
  const defaultSize = sizes?.find(s => s.isDefault)?.size || sizes?.[0]?.size || apiProduct.sizeVariants?.[0] || apiProduct.volumeMl ? `${apiProduct.volumeMl}ml` : undefined;
  
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
    tenant,
    sizes,
    defaultSize,
    abv: apiProduct.abv,
    originCountry: apiProduct.originCountry,
    region: apiProduct.region,
    volumeMl: apiProduct.volumeMl,
    availableAt: apiProduct.availableAt,
  };
};

const BestSellers: React.FC<BestSellersProps> = ({ limit = 5 }) => {
  const { addToCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openQuickview } = useModalQuickviewContext();
  const { openModalWishlist } = useModalWishlistContext();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featuredProduct, setFeaturedProduct] = useState<Product | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [activeTenant, setActiveTenant] = useState<string | null>(null);
  const [activeSize, setActiveSize] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });
  const { scrollYProgress } = useScroll({ target: containerRef, offset: ['start end', 'end start'] });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '20%']);
  const backgroundYSpring = useSpring(backgroundY, { stiffness: 80, damping: 25 });

  const featuredAvailableAt = useMemo(() => featuredProduct?.availableAt || [], [featuredProduct]);
  
  const selectedTenantEntry = useMemo(() => {
    if (!featuredAvailableAt.length) return null;
    if (activeTenant) {
      return featuredAvailableAt.find((t: any) => t.tenant?._id === activeTenant) ?? featuredAvailableAt[0];
    }
    return featuredAvailableAt[0];
  }, [featuredAvailableAt, activeTenant]);

  const tenantSizes = useMemo(() => {
    if (!selectedTenantEntry?.sizes) return [];
    return selectedTenantEntry.sizes.map((s: any) => ({
      _id: s._id,
      size: s.size,
      stock: s.stock,
      availability: s.availability,
      price: s.pricing?.websitePrice || 0,
      originalPrice: s.pricing?.originalWebsitePrice || s.pricing?.websitePrice || 0,
    }));
  }, [selectedTenantEntry]);

  const selectedSizeData = useMemo(() => {
    if (!activeSize || !tenantSizes.length) return null;
    return tenantSizes.find((s) => s.size === activeSize) || null;
  }, [activeSize, tenantSizes]);

  const isInWishlist = useMemo(() => {
    if (!featuredProduct) return false;
    return wishlistState.wishlistArray.some(item => item.id === featuredProduct._id || item._id === featuredProduct._id);
  }, [featuredProduct, wishlistState.wishlistArray]);

  const isInCart = useMemo(() => {
    if (!featuredProduct || !selectedTenantEntry || !activeSize) return false;
    const cartItemId = `${featuredProduct._id}-${activeSize || 'default'}-${selectedTenantEntry.tenant?.name || 'default'}-default`;
    return cartState.cartArray.some(item => item.cartItemId === cartItemId);
  }, [featuredProduct, selectedTenantEntry, activeSize, cartState.cartArray]);

  const getCartQuantity = useMemo(() => {
    if (!featuredProduct || !selectedTenantEntry || !activeSize) return 0;
    const cartItemId = `${featuredProduct._id}-${activeSize || 'default'}-${selectedTenantEntry.tenant?.name || 'default'}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return cartItem?.quantity || 0;
  }, [featuredProduct, selectedTenantEntry, activeSize, cartState.cartArray]);

  const inStock = (selectedSizeData?.stock || 0) > 0;

  const isProductInCart = useCallback((product: Product, tenantEntry: any, size: string | null) => {
    if (!tenantEntry || !size) return { inCart: false, quantity: 0 };
    const cartItemId = `${product._id}-${size || 'default'}-${tenantEntry.tenant?.name || 'default'}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return { inCart: !!cartItem, quantity: cartItem?.quantity || 0 };
  }, [cartState.cartArray]);

  useEffect(() => {
    const fetchBestSellers = async () => {
      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
        const response = await fetch(`${API_URL}/api/products?sort=rating&limit=${limit}`);
        
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const data = await response.json();
        const mappedProducts = (data.data?.products || data.products || []).map(mapApiProductToProduct);
        setProducts(mappedProducts);
        if (mappedProducts.length > 0) {
          const firstProduct = mappedProducts[0];
          setFeaturedProduct(firstProduct);
          
          if (firstProduct.availableAt?.length) {
            setActiveTenant(firstProduct.availableAt[0].tenant?._id || null);
            const defaultSize = firstProduct.availableAt[0].sizes?.find((s: any) => s.isDefault) || firstProduct.availableAt[0].sizes?.[0];
            setActiveSize(defaultSize?.size || null);
          }
        }
      } catch (err) {
        console.error('Error fetching best sellers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load best sellers');
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBestSellers();
  }, [limit]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const getProductImage = (product: Product, index: number = 0) => {
    return product.thumbImage?.[index] || product.primaryImage?.url || '/images/placeholder-product.png';
  };

  const formatPrice = (price: number) => '₦' + Math.round(price).toLocaleString();

  const getSoldPercentage = (product: Product) => {
    if (product.totalStock <= 0) return 0;
    return Math.min(100, Math.round((product.totalSold / product.totalStock) * 100));
  };

  const getStockStatus = (product: Product) => {
    const percentage = getSoldPercentage(product);
    if (percentage >= 90) return { text: 'Almost Gone', color: 'text-red-500', bg: 'bg-red-500', icon: <Icon.PiWarningCircle size={12} /> };
    if (percentage >= 70) return { text: 'Selling Fast', color: 'text-orange-500', bg: 'bg-orange-500', icon: <Icon.PiTrendUp size={12} /> };
    if (percentage >= 50) return { text: 'Limited Stock', color: 'text-yellow-500', bg: 'bg-yellow-500', icon: <Icon.PiArchive size={12} /> };
    return { text: 'In Stock', color: 'text-green-500', bg: 'bg-green-500', icon: <Icon.PiCheckCircle size={12} /> };
  };

  const handleAddToCart = async (product: Product) => {
    setAddingToCart(product._id);
    try {
      let targetAvailableAt = product.availableAt?.[0];
      let targetSize = activeSize;
      
      if (product === featuredProduct && selectedTenantEntry) {
        targetAvailableAt = selectedTenantEntry;
      }
      
      if (!targetAvailableAt) {
        throw new Error('No tenant entry found');
      }

      const sizeData = targetAvailableAt.sizes?.find((s: any) => s.size === targetSize) || targetAvailableAt.sizes?.[0];
      
      if (!targetSize || !sizeData) {
        showToast('Please select a size', 'error');
        setAddingToCart(null);
        return;
      }

      if (sizeData.stock <= 0) {
        showToast('This size is out of stock', 'error');
        setAddingToCart(null);
        return;
      }

      const cartItemId = `${product._id}-${targetSize || 'default'}-${targetAvailableAt.tenant?.name || 'default'}-default`;
      const existingItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
      const wasAlreadyInCart = !!existingItem;
      
      await addToCart(
        product,
        sizeData.size,
        '',
        targetAvailableAt.tenant?.name || '',
        targetAvailableAt.tenant?._id || '',
        1,
        sizeData._id,
        targetAvailableAt._id || ''
      );
      
      await new Promise(resolve => setTimeout(resolve, 400));
      showToast(wasAlreadyInCart ? `Quantity increased to ${(existingItem?.quantity || 0) + 1}!` : 'Added to cart successfully!', 'success');
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
      const inWishlist = wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
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

  if (loading) {
    return (
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 bg-gradient-to-br from-purple-50 via-white to-pink-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-10 md:mb-12">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-100 rounded-full text-sm font-medium text-purple-700 mb-3 sm:mb-4">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2 }}>
                <Icon.PiCrownFill size={16} />
              </motion.div>
              <span className="hidden sm:inline">Top Rated</span>
              <span className="sm:hidden">Top</span>
            </div>
            <div className="h-8 sm:h-10 md:h-12 bg-gray-200 rounded-lg sm:rounded-xl w-40 sm:w-48 md:w-56 mx-auto shimmer" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">
            <motion.div className="aspect-[3/5] sm:aspect-[1/1] md:aspect-auto md:h-[300px] lg:h-[350px] bg-gray-200 rounded-xl sm:rounded-2xl shimmer" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 2 }} />
            <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 content-start">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square sm:aspect-[3/4] bg-gray-200 rounded-xl sm:rounded-2xl shimmer" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const displayProducts = products.slice(1, limit);

  return (
    <section ref={containerRef} className="py-12 sm:py-16 md:py-20 lg:py-24 relative overflow-hidden bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <motion.div className="absolute inset-0 pointer-events-none" style={{ y: backgroundYSpring }}>
        <motion.div className="absolute top-10 sm:top-20 -left-10 sm:left-10 w-48 sm:w-64 md:w-96 h-48 sm:h-64 md:h-96 bg-purple-200/30 rounded-full blur-xl sm:blur-3xl" animate={{ scale: [1, 1.2, 1], x: [0, 20, 0] }} transition={{ repeat: Infinity, duration: 12 }} />
        <motion.div className="absolute bottom-10 sm:bottom-20 -right-10 sm:right-10 w-40 sm:w-64 h-40 sm:h-64 bg-pink-200/30 rounded-full blur-xl sm:blur-3xl" animate={{ scale: [1.2, 1, 1.2], x: [0, -20, 0] }} transition={{ repeat: Infinity, duration: 10 }} />
      </motion.div>

      <AnimatePresence>{toast && (
        <motion.div 
          initial={{ opacity: 0, y: 50, scale: 0.9 }} 
          animate={{ opacity: 1, y: 0, scale: 1 }} 
          exit={{ opacity: 0, y: -20, scale: 0.9 }} 
          className={`fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-50 px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl shadow-2xl flex items-center gap-2 sm:gap-3 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white`}
        >
          {toast.type === 'success' ? <Icon.PiCheckCircle size={22} /> : <Icon.PiWarningCircle size={22} />}
          <span className="font-semibold text-sm sm:text-base">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 sm:ml-2 hover:opacity-70">
            <Icon.PiX size={18} />
          </button>
        </motion.div>
      )}</AnimatePresence>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }} 
          whileInView={{ opacity: 1, y: 0, scale: 1 }} 
          viewport={{ once: true }} 
          transition={{ duration: 0.5 }}
          className="text-center mb-10 sm:mb-12 md:mb-16"
        >
          <motion.div 
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full text-sm font-medium text-purple-800 mb-3 sm:mb-4 shadow-lg shadow-purple-500/10"
            whileHover={{ scale: 1.02 }}
          >
            <motion.span animate={{ rotate: [0, 8, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
              <Icon.PiCrownFill size={16} className="text-purple-600" />
            </motion.span>
            <span>Top Rated</span>
          </motion.div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-2 sm:mb-3">
            Best<span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600"> Sellers</span>
          </h2>
          <p className="text-gray-500 text-sm sm:text-base max-w-xl mx-auto">Discover our customers' absolute favorites - the products everyone loves</p>
        </motion.div>

        <AnimatePresence>{error && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center py-10 sm:py-12 bg-white rounded-2xl sm:rounded-3xl shadow-lg mb-8 mx-auto max-w-md">
            <Icon.PiWarningCircle size={48} className="mx-auto text-red-400 mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Unable to Load Products</h3>
            <p className="text-gray-500 text-sm mb-4">{error}</p>
            <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg sm:rounded-xl font-semibold hover:bg-purple-700 transition-colors text-sm sm:text-base">
              <Icon.PiArrowClockwise size={18} /> Try Again
            </button>
          </motion.div>
        )}</AnimatePresence>

        {products.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 md:gap-8">
            {featuredProduct && (
              <motion.div 
                initial={{ opacity: 0, y: 30 }} 
                whileInView={{ opacity: 1, y: 0 }} 
                viewport={{ once: true }} 
                transition={{ duration: 0.5 }}
                className="lg:col-span-7 xl:col-span-8"
              >
                <motion.div 
                  className="relative bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-xl sm:shadow-2xl lg:shadow-purple-900/10 group h-full min-h-[400px] sm:min-h-[450px] md:min-h-[500px] lg:min-h-[550px]" 
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="absolute top-4 left-4 z-20">
                    <motion.div 
                      initial={{ x: -30, opacity: 0 }} 
                      animate={{ x: 0, opacity: 1 }} 
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full font-bold text-xs sm:text-sm shadow-lg"
                    >
                      <Icon.PiTrophyFill size={14} />
                      <span className="hidden sm:inline">#1 Best Seller</span>
                      <span className="sm:hidden">#1</span>
                    </motion.div>
                  </div>

                  <div className="relative aspect-[3/5] sm:aspect-[1/1] md:aspect-auto md:absolute md:inset-0">
                    {!imageLoaded[featuredProduct._id] && (
                      <motion.div className="absolute inset-0 bg-gradient-to-r from-purple-100 to-pink-100 animate-pulse z-10" />
                    )}
                    <Image 
                      src={getProductImage(featuredProduct, 0)} 
                      alt={featuredProduct.name} 
                      fill 
                      className="object-cover transition-all duration-500 group-hover:scale-105" 
                      onLoad={() => setImageLoaded(prev => ({ ...prev, [featuredProduct._id]: true }))} 
                      priority 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/30 to-transparent md:w-2/3 lg:w-3/5" />
                    
                    <motion.div 
                      className="absolute top-3 sm:top-4 right-3 sm:right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 z-20"
                    >
                      <motion.button 
                        whileHover={!wishlistAdding ? { scale: 1.1 } : {}}
                        whileTap={!wishlistAdding ? { scale: 0.9 } : {}}
                        onClick={() => handleWishlistToggle(featuredProduct)}
                        disabled={wishlistAdding === featuredProduct._id}
                        className={`w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center shadow-lg transition-all text-sm sm:text-base ${
                          wishlistAdding === featuredProduct._id 
                            ? 'bg-gray-400'
                            : isInWishlist 
                              ? 'bg-red-500 text-white' 
                              : 'bg-white/90 text-gray-700 hover:bg-red-500 hover:text-white'
                        }`}
                      >
                        {wishlistAdding === featuredProduct._id ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                            <Icon.PiSpinner size={18} />
                          </motion.div>
                        ) : isInWishlist ? (
                          <Icon.PiHeartFill size={18} />
                        ) : (
                          <Icon.PiHeart size={18} />
                        )}
                      </motion.button>
                      <motion.button 
                        whileHover={{ scale: 1.1 }} 
                        whileTap={{ scale: 0.9 }} 
                        onClick={() => openQuickview({ _id: featuredProduct._id, name: featuredProduct.name, slug: featuredProduct.slug, price: featuredProduct.price, originPrice: featuredProduct.originPrice, sale: featuredProduct.sale, thumbImage: featuredProduct.thumbImage, quantityPurchase: 1 } as any)}
                        className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full bg-white/90 text-gray-700 flex items-center justify-center shadow-lg hover:bg-purple-600 hover:text-white transition-colors text-sm sm:text-base"
                      >
                        <Icon.PiEye size={18} />
                      </motion.button>
                    </motion.div>

                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 md:p-6 lg:p-7 xl:p-8 md:w-2/3 lg:w-3/5">
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                          {featuredProduct.category && (
                            <span className="text-purple-200 sm:text-purple-300 text-xs sm:text-sm font-medium uppercase tracking-wider">{featuredProduct.category.name}</span>
                          )}
                          
                          {featuredProduct.tenant && (
                            <Link 
                              href={`/shop?tenant=${featuredProduct.tenant.slug}`} 
                              className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs sm:text-sm hover:bg-white/30 transition-colors"
                            >
                              <Icon.PiStorefront size={12} />
                              <span className="hidden sm:inline">{selectedTenantEntry?.tenant?.name || featuredProduct.tenant.name}</span>
                              <span className="sm:hidden">{(selectedTenantEntry?.tenant?.name || featuredProduct.tenant.name).split(' ')[0]}</span>
                              {(selectedTenantEntry?.tenant?.city || featuredProduct.tenant.city) && <span className="hidden md:inline opacity-70">• {selectedTenantEntry?.tenant?.city || featuredProduct.tenant.city}</span>}
                            </Link>
                          )}
                          
                          {featuredProduct.defaultSize && (
                            <span className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs sm:text-sm">
                              <Icon.PiFlask size={12} />
                              <span>{featuredProduct.defaultSize}</span>
                            </span>
                          )}
                          
                          {featuredProduct.abv && (
                            <span className="flex items-center gap-1 px-2 sm:px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs sm:text-sm">
                              <Icon.PiWine size={12} />
                              <span>{featuredProduct.abv}%</span>
                            </span>
                          )}
                          
                          {featuredProduct.originCountry && (
                            <span className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-white text-xs sm:text-sm">
                              <Icon.PiGlobe size={12} />
                              <span>{featuredProduct.originCountry}</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 group-hover:text-purple-200 transition-colors line-clamp-2">{featuredProduct.name}</h3>
                        <p className="text-gray-300 text-xs sm:text-sm line-clamp-2 mb-3 sm:mb-4 hidden sm:block">{featuredProduct.description || `${featuredProduct.name} - Premium quality product`}</p>
                        
                        {tenantSizes.length > 1 && (
                          <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                            {tenantSizes.slice(0, 4).map((size) => (
                              <motion.button
                                key={size._id}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setActiveSize(size.size)}
                                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                                  activeSize === size.size 
                                    ? 'bg-white text-purple-600' 
                                    : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                              >
                                {size.size}
                              </motion.button>
                            ))}
                          </div>
                        )}

                        {featuredProduct.averageRating > 0 && (
                          <div className="flex items-center gap-2 mb-3 sm:mb-4">
                            <div className="flex gap-0.5 sm:gap-1">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Icon.PiStarFill 
                                  key={i} 
                                  size={14} 
                                  className={i < Math.floor(featuredProduct.averageRating) ? 'text-amber-400' : 'text-gray-500'} 
                                />
                              ))}
                            </div>
                            <span className="text-amber-400 font-semibold text-xs sm:text-sm">{featuredProduct.averageRating.toFixed(1)}</span>
                            <span className="text-gray-400 text-xs sm:text-sm">({featuredProduct.reviewCount})</span>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-3 sm:mb-5">
                          <span className="text-xl sm:text-2xl md:text-3xl font-bold text-white">{formatPrice(featuredProduct.price)}</span>
                          {featuredProduct.sale && featuredProduct.originPrice > featuredProduct.price && (
                            <>
                              <span className="text-sm sm:text-base text-gray-400 line-through">{formatPrice(featuredProduct.originPrice)}</span>
                              <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-red-500 text-white text-xs sm:text-sm font-bold rounded-lg">-{featuredProduct.discount}%</span>
                            </>
                          )}
                        </div>

                        <div className="space-y-1.5 sm:space-y-2 mb-4 sm:mb-5">
                          <div className="flex items-center justify-between text-xs sm:text-sm">
                            <span className="text-gray-400 flex items-center gap-1">
                              {getStockStatus(featuredProduct).icon} 
                              <span className="hidden sm:inline">{getStockStatus(featuredProduct).text}</span>
                              <span className="sm:hidden">{getStockStatus(featuredProduct).text.split(' ')[0]}</span>
                            </span>
                            <span className="text-gray-400">{getSoldPercentage(featuredProduct)}% sold</span>
                          </div>
                          <div className="h-1.5 sm:h-2 bg-gray-700/50 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }} 
                              whileInView={{ width: `${getSoldPercentage(featuredProduct)}%` }} 
                              transition={{ duration: 0.8, delay: 0.3 }} 
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full" 
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 sm:gap-3">
                          <motion.button 
                            whileHover={!isInCart && !addingToCart ? { scale: 1.02 } : {}}
                            whileTap={!isInCart && !addingToCart ? { scale: 0.98 } : {}}
                            onClick={() => handleAddToCart(featuredProduct)}
                            disabled={addingToCart === featuredProduct._id || isInCart}
                            className={`relative flex-1 py-2.5 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl font-semibold sm:font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                              addingToCart === featuredProduct._id 
                                ? 'bg-green-500 text-white'
                                : isInCart 
                                  ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                                  : 'bg-white text-gray-900 hover:bg-purple-600 hover:text-white'
                            }`}
                          >
                            {addingToCart === featuredProduct._id ? (
                              <>
                                <motion.div 
                                  initial={{ scale: 0 }} 
                                  animate={{ scale: 1 }} 
                                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                >
                                  <Icon.PiCheck size={18} />
                                </motion.div>
                                <span className="hidden sm:inline">Added!</span>
                                <span className="sm:hidden">OK</span>
                              </>
                            ) : isInCart ? (
                              <>
                                <Icon.PiShoppingCart size={16} />
                                <span className="hidden sm:inline">In Cart ({getCartQuantity})</span>
                                <span className="sm:hidden">({getCartQuantity})</span>
                              </>
                            ) : (
                              <>
                                <Icon.PiShoppingCart size={16} />
                                <span className="hidden sm:inline">Add to Cart</span>
                                <span className="sm:hidden">Add</span>
                              </>
                            )}
                          </motion.button>
                          <Link 
                            href={`/product/${featuredProduct.slug}`} 
                            className="px-3 sm:px-4 md:px-5 py-2.5 sm:py-3 md:py-3.5 rounded-lg sm:rounded-xl font-semibold sm:font-bold text-sm sm:text-base border-2 border-white/30 text-white hover:bg-white/10 flex items-center justify-center transition-all"
                          >
                            <Icon.PiArrowRight size={16} />
                          </Link>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            <motion.div 
              className="lg:col-span-5 xl:col-span-4"
              initial={{ opacity: 0, y: 30 }} 
              whileInView={{ opacity: 1, y: 0 }} 
              viewport={{ once: true }} 
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-1 gap-3 sm:gap-4 content-start">
                {displayProducts.map((product, index) => (
                  <motion.div 
                    key={product._id} 
                    initial={{ opacity: 0, y: 20 }} 
                    whileInView={{ opacity: 1, y: 0 }} 
                    viewport={{ once: true }} 
                    transition={{ delay: index * 0.08 }}
                    className="group"
                  >
                    <motion.div 
                      className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full" 
                      whileHover={{ y: -2 }}
                    >
                      <div className="relative aspect-square sm:aspect-[4/5] lg:aspect-[3/2] xl:aspect-[5/2]">
                        {!imageLoaded[product._id] && (
                          <motion.div className="absolute inset-0 bg-gray-100 animate-pulse" />
                        )}
                        <Image 
                          src={getProductImage(product, 0)} 
                          alt={product.name} 
                          fill 
                          className="object-cover transition-transform duration-500 group-hover:scale-105" 
                          onLoad={() => setImageLoaded(prev => ({ ...prev, [product._id]: true }))} 
                        />
                        {product.sale && (
                          <div className="absolute top-2 left-2 px-2 py-0.5 sm:py-1 bg-red-500 text-white text-xs font-bold rounded-lg">
                            -{product.discount}%
                          </div>
                        )}
                      </div>
                      <div className="p-3 sm:p-4">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {product.category && (
                            <span className="text-purple-600 text-xs font-medium uppercase tracking-wider">{product.category.name}</span>
                          )}
                        </div>
                        
                        <Link href={`/product/${product.slug}`}>
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base mb-1.5 line-clamp-2 group-hover:text-purple-600 transition-colors leading-tight">{product.name}</h4>
                        </Link>
                        
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 text-xs text-gray-500">
                          {product.tenant && (
                            <Link href={`/shop?tenant=${product.tenant.slug}`} className="flex items-center gap-0.5 hover:text-purple-600 transition-colors">
                              <Icon.PiStorefront size={12} />
                              <span className="hidden sm:inline">{product.tenant.name}</span>
                              <span className="sm:hidden truncate max-w-[60px]">{product.tenant.name}</span>
                            </Link>
                          )}
                          {product.defaultSize && (
                            <span className="flex items-center gap-0.5">
                              <Icon.PiFlask size={12} />
                              <span>{product.defaultSize}</span>
                            </span>
                          )}
                        </div>

                        {product.averageRating > 0 && (
                          <div className="flex items-center gap-1.5 mb-2">
                            <div className="flex gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Icon.PiStarFill 
                                  key={i} 
                                  size={12} 
                                  className={i < Math.floor(product.averageRating) ? 'text-amber-400' : 'text-gray-200'} 
                                />
                              ))}
                            </div>
                            <span className="text-amber-500 font-semibold text-xs">{product.averageRating.toFixed(1)}</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base sm:text-lg font-bold text-gray-900">{formatPrice(product.price)}</span>
                          {product.sale && product.originPrice > product.price && (
                            <span className="text-xs sm:text-sm text-gray-400 line-through">{formatPrice(product.originPrice)}</span>
                          )}
                        </div>

                        <div className="flex gap-1.5 sm:gap-2">
                          {(() => {
                            const productTenant = product.availableAt?.[0];
                            const { inCart, quantity } = isProductInCart(product, productTenant, productTenant?.sizes?.[0]?.size || null);
                            return (
                              <motion.button 
                                whileHover={!inCart && !addingToCart ? { scale: 1.02 } : {}}
                                whileTap={!inCart && !addingToCart ? { scale: 0.95 } : {}}
                                onClick={() => handleAddToCart(product)} 
                                disabled={addingToCart === product._id || inCart}
                                className={`relative flex-1 py-2 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm flex items-center justify-center gap-1 transition-all ${
                                  addingToCart === product._id 
                                    ? 'bg-green-500 text-white'
                                    : inCart 
                                      ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                                      : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                              >
                                {addingToCart === product._id ? (
                                  <>
                                    <motion.div 
                                      initial={{ scale: 0 }} 
                                      animate={{ scale: 1 }} 
                                      transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                    >
                                      <Icon.PiCheck size={14} />
                                    </motion.div>
                                    <span className="hidden sm:inline">Added!</span>
                                  </>
                                ) : inCart ? (
                                  <>
                                    <Icon.PiShoppingCart size={14} />
                                    <span className="hidden sm:inline">({quantity})</span>
                                  </>
                                ) : (
                                  <>
                                    <Icon.PiShoppingCart size={14} />
                                    <span className="hidden sm:inline">Add</span>
                                    <span className="sm:hidden">+</span>
                                  </>
                                )}
                              </motion.button>
                            );
                          })()}
                          <motion.button 
                            whileHover={!wishlistAdding ? { scale: 1.02 } : {}}
                            whileTap={!wishlistAdding ? { scale: 0.95 } : {}}
                            onClick={() => handleWishlistToggle(product)}
                            disabled={wishlistAdding === product._id}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all ${
                              wishlistAdding === product._id 
                                ? 'bg-gray-400'
                                : wishlistState.wishlistArray.some(i => i.id === product._id || i._id === product._id) 
                                  ? 'bg-red-500 text-white' 
                                  : 'bg-gray-100 text-gray-600 hover:bg-red-500 hover:text-white'
                            }`}
                          >
                            {wishlistAdding === product._id ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                                <Icon.PiSpinner size={14} />
                              </motion.div>
                            ) : wishlistState.wishlistArray.some(i => i.id === product._id || i._id === product._id) ? (
                              <Icon.PiHeartFill size={16} />
                            ) : (
                              <Icon.PiHeart size={16} />
                            )}
                          </motion.button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        )}

        {products.length === 0 && !error && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="text-center py-12 sm:py-16 bg-white rounded-2xl sm:rounded-3xl shadow-lg"
          >
            <Icon.PiPackage size={56} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">No Best Sellers Yet</h3>
            <p className="text-gray-500 text-sm sm:text-base">Check back soon for our top-rated products!</p>
          </motion.div>
        )}

        <motion.div 
          className="text-center mt-8 sm:mt-12 md:mt-16" 
          initial={{ opacity: 0, y: 20 }} 
          whileInView={{ opacity: 1, y: 0 }} 
          viewport={{ once: true }}
        >
          <Link 
            href="/shop?sort=rating" 
            className="inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl sm:rounded-2xl font-bold text-sm sm:text-lg shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            <span>View All Best Sellers</span>
            <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Icon.PiArrowRight size={20} />
            </motion.span>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default BestSellers;
