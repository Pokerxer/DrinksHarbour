'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  city?: string;
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
  pricing?: {
    websitePrice?: number;
    originalWebsitePrice?: number;
    compareAtPrice?: number;
  };
  isOnSale?: boolean;
  saleDiscountValue?: number;
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
  images?: Array<{ url: string; alt?: string }>;
  priceRange?: { min: number; max: number };
  discount?: { value?: number };
  badge?: { name?: string };
  category?: { name: string; slug: string };
  averageRating?: number;
  reviewCount?: number;
  totalSold?: number;
  createdAt?: string;
  abv?: number;
  originCountry?: string;
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
  category?: { name: string };
  averageRating: number;
  reviewCount: number;
  isNew: boolean;
  totalSold: number;
  totalStock: number;
  sizes?: ProductSize[];
  defaultSize?: string;
  abv?: number;
  originCountry?: string;
  volumeMl?: number;
  availableAt?: AvailableAtEntry[];
}

interface FeaturedProductsProps {
  limit?: number;
  title?: string;
  subtitle?: string;
}

const mapApiProductToProduct = (apiProduct: ApiProduct): Product => {
  const thumbImage: string[] = [];
  
  if (apiProduct.primaryImage?.url) {
    thumbImage.push(apiProduct.primaryImage.url);
  }
  
  if (apiProduct.images) {
    apiProduct.images.forEach((img) => {
      if (img.url && !thumbImage.includes(img.url)) {
        thumbImage.push(img.url);
      }
    });
  }

  if (thumbImage.length === 0) {
    thumbImage.push('/images/placeholder-product.png');
  }

  const availableAt = apiProduct.availableAt?.[0];
  const pricing = availableAt?.pricing;
  const sizes = availableAt?.sizes;
  const defaultSize = sizes?.[0]?.size || apiProduct.volumeMl ? `${apiProduct.volumeMl}ml` : undefined;
  
  const websitePrice = pricing?.websitePrice || apiProduct.priceRange?.min || 0;
  const compareAtPrice = pricing?.compareAtPrice || pricing?.originalWebsitePrice || apiProduct.priceRange?.max || websitePrice;
  
  const isOnSale = availableAt?.isOnSale || (apiProduct.discount?.value && apiProduct.discount.value > 0);
  const saleDiscountValue = availableAt?.saleDiscountValue || apiProduct.discount?.value || 0;
  const sale = !!(isOnSale && saleDiscountValue > 0);
  const discount = sale ? Math.round(saleDiscountValue) : 0;
  const price = sale ? Math.round(compareAtPrice * (1 - discount / 100)) : websitePrice;

  return {
    _id: apiProduct._id,
    slug: apiProduct.slug,
    name: apiProduct.name,
    price,
    originPrice: compareAtPrice,
    sale,
    discount,
    thumbImage,
    primaryImage: apiProduct.primaryImage,
    category: apiProduct.category,
    averageRating: apiProduct.averageRating || 0,
    reviewCount: apiProduct.reviewCount || 0,
    isNew: false,
    totalSold: apiProduct.totalSold || 50,
    totalStock: 100,
    sizes,
    defaultSize,
    abv: apiProduct.abv,
    originCountry: apiProduct.originCountry,
    volumeMl: apiProduct.volumeMl,
    availableAt: apiProduct.availableAt,
  };
};

const ProductCard = ({ 
  product, 
  index, 
  onAddToCart,
  onWishlistToggle,
  onRemoveFromCart,
  addingToCart,
  wishlistAdding,
  inWishlist,
  inCart,
  cartQty
}: { 
  product: Product;
  index: number;
  onAddToCart: () => void;
  onWishlistToggle: () => void;
  onRemoveFromCart?: () => void;
  addingToCart: boolean;
  wishlistAdding: boolean;
  inWishlist: boolean;
  inCart: boolean;
  cartQty: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(product.sizes?.[0] || null);
  const [imgError, setImgError] = useState(false);
  
  const mainImage = product.thumbImage?.[0] || product.primaryImage?.url;
  const hasSecondImage = (product.thumbImage?.length || 0) > 1;
  
  const soldPercentage = Math.min(100, Math.round((product.totalSold / product.totalStock) * 100));

  const getStockStatus = () => {
    if (soldPercentage >= 90) return { text: 'Almost Gone', color: 'text-red-500 bg-red-100', dot: 'bg-red-500' };
    if (soldPercentage >= 70) return { text: 'Selling Fast', color: 'text-orange-500 bg-orange-100', dot: 'bg-orange-500' };
    if (soldPercentage >= 50) return { text: 'Limited', color: 'text-yellow-600 bg-yellow-100', dot: 'bg-yellow-500' };
    return { text: 'In Stock', color: 'text-emerald-600 bg-emerald-100', dot: 'bg-emerald-500' };
  };

  const stockStatus = getStockStatus();

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -6 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative"
    >
      <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-gray-100">
        {/* Image Section */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          <Link href={`/product/${product.slug}`}>
            <div className="relative w-full h-full">
              {!imgError && mainImage ? (
                <>
                  <img
                    src={mainImage}
                    alt={product.name}
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                      hasSecondImage && isHovered ? 'opacity-0 scale-110' : 'opacity-100 scale-100'
                    }`}
                    onError={() => setImgError(true)}
                  />
                  {hasSecondImage && product.thumbImage?.[1] && (
                    <img
                      src={product.thumbImage[1]}
                      alt={`${product.name} view 2`}
                      className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${
                        isHovered ? 'opacity-100 scale-105' : 'opacity-0 scale-100'
                      }`}
                    />
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                  <span className="text-5xl opacity-30">✨</span>
                </div>
              )}
            </div>
          </Link>

          {/* Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-2">
            {product.sale && product.discount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2.5 py-1 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-lg shadow-lg"
              >
                -{product.discount}%
              </motion.div>
            )}
            {product.isNew && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2.5 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold rounded-lg shadow-lg"
              >
                NEW
              </motion.div>
            )}
            {product.averageRating >= 4.5 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="px-2.5 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg shadow-lg flex items-center gap-1"
              >
                <Icon.PiStarFill size={10} />
                TOP
              </motion.div>
            )}
          </div>

          {/* Wishlist Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onWishlistToggle}
            disabled={wishlistAdding}
            className={`absolute top-3 right-3 z-20 w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
              wishlistAdding
                ? 'bg-gray-400'
                : inWishlist
                  ? 'bg-red-500 text-white'
                  : 'bg-white/95 text-gray-500 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            {wishlistAdding ? (
              <Icon.PiSpinner size={18} className="animate-spin" />
            ) : inWishlist ? (
              <Icon.PiHeartFill size={18} />
            ) : (
              <Icon.PiHeart size={18} />
            )}
          </motion.button>

          {/* Vendor Badge */}
          {product.availableAt?.[0]?.tenant && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-3 left-3 z-10"
            >
              <div className="bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg shadow-md border border-gray-100">
                <span className="text-[10px] font-medium text-gray-600 truncate max-w-[80px] block">
                  {product.availableAt[0].tenant.name}
                </span>
              </div>
            </motion.div>
          )}

          {/* Quick Add Button */}
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
                e.stopPropagation();
                if (inCart && onRemoveFromCart) {
                  onRemoveFromCart();
                } else {
                  onAddToCart();
                }
              }}
              disabled={addingToCart}
              className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                addingToCart
                  ? 'bg-violet-500 text-white'
                  : inCart
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {addingToCart ? (
                <Icon.PiSpinner size={18} className="animate-spin" />
              ) : inCart ? (
                <Icon.PiTrash size={18} />
              ) : (
                <Icon.PiPlus size={18} />
              )}
            </motion.button>
          </motion.div>
        </div>

        {/* Content Section */}
        <div className="p-4">
          {/* Category */}
          {product.category && (
            <span className="text-[10px] font-semibold text-violet-500 uppercase tracking-wider">
              {product.category.name}
            </span>
          )}

          {/* Product Name */}
          <Link href={`/product/${product.slug}`}>
            <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-violet-600 transition-colors mt-1 min-h-[2.5rem]">
              {product.name}
            </h3>
          </Link>

          {/* Rating */}
          {product.averageRating > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon.PiStarFill
                    key={i}
                    size={10}
                    className={i < Math.floor(product.averageRating) ? 'text-amber-400' : 'text-gray-200'}
                  />
                ))}
              </div>
              <span className="text-[10px] text-gray-500">
                {product.averageRating.toFixed(1)} ({product.reviewCount})
              </span>
            </div>
          )}

          {/* Price Section */}
          <div className="mt-3 flex items-end gap-2">
            {product.sale ? (
              <>
                <span className="text-lg font-black text-gray-900">
                  ₦{product.price.toLocaleString()}
                </span>
                <span className="text-xs text-gray-400 line-through">
                  ₦{product.originPrice.toLocaleString()}
                </span>
                <span className="ml-auto text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                  -{product.discount}%
                </span>
              </>
            ) : (
              <span className="text-lg font-black text-gray-900">
                ₦{product.price.toLocaleString()}
              </span>
            )}
          </div>

          {/* Size Selector */}
          {product.sizes && product.sizes.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {product.sizes.slice(0, 3).map((size) => (
                <button
                  key={size._id}
                  onClick={() => setSelectedSize(size)}
                  className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${
                    selectedSize?._id === size._id
                      ? 'bg-violet-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {size.size}
                </button>
              ))}
              {product.sizes.length > 3 && (
                <span className="px-2 py-0.5 text-[10px] text-gray-400">
                  +{product.sizes.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Stock Status */}
          <div className="mt-3 flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${stockStatus.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stockStatus.dot}`} />
              {stockStatus.text}
            </div>
            <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${stockStatus.dot}`}
                style={{ width: `${soldPercentage}%` }}
              />
            </div>
          </div>

          {/* In Cart Indicator */}
          {inCart && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-3 flex items-center justify-center gap-1.5 bg-violet-50 text-violet-600 px-3 py-1.5 rounded-lg text-xs font-semibold"
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

const FeaturedProducts: React.FC<FeaturedProductsProps> = ({
  limit = 8,
  title = "Featured Products",
  subtitle = "Handpicked selections from our premium collection"
}) => {
  const sectionRef = useRef<HTMLDivElement>(null);
  
  const { addToCart, removeFromCart, cartState } = useCart();
  const { openModalCart } = useModalCartContext();
  const { wishlistState, addToWishlist, removeFromWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [wishlistAdding, setWishlistAdding] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchFeaturedProducts();
  }, [limit]);

  const fetchFeaturedProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${API_URL}/api/products?isFeatured=true&limit=${limit}`);
      
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
        setError('No featured products found');
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

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
      
      const existingItem = cartState.cartArray.find(item => item.cartItemId === `${product._id}-${size}-${tenantName || 'default'}-default`);
      
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
      
      showToast(existingItem ? `Quantity increased to ${(existingItem?.quantity || 0) + 1}!` : `${product.name} added!`, 'success');
      openModalCart();
    } catch {
      showToast('Failed to add to cart', 'error');
    } finally {
      setTimeout(() => setAddingToCart(null), 300);
    }
  };

  const handleRemoveFromCart = (product: Product) => {
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

  if (loading) {
    return (
      <section ref={sectionRef} className="py-16 sm:py-24 bg-gradient-to-b from-white to-violet-50/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-violet-100 rounded-full text-xs font-bold text-violet-700 mb-4">
              <Icon.PiStarFill size={14} />
              Premium Selection
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

  if (error || products.length === 0) return null;

  const totalVendors = products.reduce((sum, p) => sum + (p.availableAt?.[0]?.tenant ? 1 : 0), 0);
  const avgRating = products.reduce((sum, p) => sum + p.averageRating, 0) / products.length;

  return (
    <section ref={sectionRef} className="py-16 sm:py-24 bg-gradient-to-b from-white via-violet-50/20 to-white overflow-hidden">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-2.5 text-white ${
              toast.type === 'success' ? 'bg-violet-500' : 'bg-red-500'
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-100 to-purple-100 rounded-full text-xs font-bold text-violet-700 mb-4 shadow-sm"
          >
            <Icon.PiStarFill size={14} className="text-violet-500" />
            Premium Selection
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
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                <Icon.PiSparkle size={18} className="text-violet-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">{products.length}</div>
                <div className="text-xs text-gray-500">Featured</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Icon.PiStar size={18} className="text-amber-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">{avgRating.toFixed(1)}</div>
                <div className="text-xs text-gray-500">Avg Rating</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                <Icon.PiStorefront size={18} className="text-emerald-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">{totalVendors}</div>
                <div className="text-xs text-gray-500">Vendors</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {products.map((product, index) => (
            <ProductCard
              key={product._id}
              product={product}
              index={index}
              onAddToCart={() => handleAddToCart(product)}
              onWishlistToggle={() => handleWishlistToggle(product)}
              onRemoveFromCart={() => handleRemoveFromCart(product)}
              addingToCart={addingToCart === product._id}
              wishlistAdding={wishlistAdding === product._id}
              inWishlist={isProductInWishlist(product)}
              inCart={isProductInCart(product)}
              cartQty={getCartQuantity(product)}
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
            href="/shop?isFeatured=true"
            className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-full hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
          >
            View All Featured Products
            <Icon.PiArrowRight size={20} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
