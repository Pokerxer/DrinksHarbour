'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  };
  isOnSale?: boolean;
  saleDiscountValue?: number;
}

interface ApiProduct {
  _id: string;
  name: string;
  slug: string;
  type: string;
  description?: string;
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
  tenant?: Tenant;
  sizes?: ProductSize[];
  defaultSize?: string;
  abv?: number;
  originCountry?: string;
  volumeMl?: number;
  availableAt?: AvailableAtEntry[];
  description?: string;
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
  const compareAtPrice = pricing?.originalWebsitePrice || apiProduct.priceRange?.max || websitePrice;
  
  const isOnSaleFromApi = availableAt?.isOnSale || (apiProduct.discount?.value && apiProduct.discount.value > 0);
  const saleDiscountValue = availableAt?.saleDiscountValue || apiProduct.discount?.value || 0;
  
  const sale = !!(isOnSaleFromApi && saleDiscountValue > 0);
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
    tenant: availableAt?.tenant,
    sizes,
    defaultSize,
    abv: apiProduct.abv,
    originCountry: apiProduct.originCountry,
    volumeMl: apiProduct.volumeMl,
    availableAt: apiProduct.availableAt,
    description: apiProduct.description,
  };
};

const FeaturedProductCard = ({ 
  product,
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
  onAddToCart: (size?: ProductSize) => void;
  onWishlistToggle: () => void;
  onRemoveFromCart?: () => void;
  addingToCart: boolean;
  wishlistAdding: boolean;
  inWishlist: boolean;
  inCart: boolean;
  cartQty: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(product.sizes?.[0] || null);
  
  const mainImage = product.thumbImage?.[0] || product.primaryImage?.url;
  const soldPercentage = Math.min(100, Math.round((product.totalSold / product.totalStock) * 100));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group"
    >
      <div className="bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border border-gray-100">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          <Link href={`/product/${product.slug}`}>
            <div className="relative w-full h-full">
              {!imgError && mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${
                    isHovered ? 'scale-110' : 'scale-100'
                  }`}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                  <span className="text-6xl opacity-30">👑</span>
                </div>
              )}
            </div>
          </Link>

          {/* #1 Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-4 left-4 z-10"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-amber-500 blur-md opacity-40 rounded-xl" />
              <div className="relative bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2">
                <Icon.PiTrophyFill size={16} />
                <span className="font-bold text-sm">#1 Best Seller</span>
              </div>
            </div>
          </motion.div>

          {/* Wishlist Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onWishlistToggle}
            disabled={wishlistAdding}
            className={`absolute top-4 right-4 z-20 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${
              wishlistAdding
                ? 'bg-gray-400'
                : inWishlist
                  ? 'bg-red-500 text-white'
                  : 'bg-white/95 text-gray-500 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            {wishlistAdding ? (
              <Icon.PiSpinner size={20} className="animate-spin" />
            ) : inWishlist ? (
              <Icon.PiHeartFill size={20} />
            ) : (
              <Icon.PiHeart size={20} />
            )}
          </motion.button>

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-3">
              {product.category && (
                <span className="text-white/80 text-xs font-medium uppercase tracking-wider">
                  {product.category.name}
                </span>
              )}
              {product.tenant && (
                <span className="flex items-center gap-1 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-white text-xs">
                  <Icon.PiStorefront size={10} />
                  {product.tenant.name}
                </span>
              )}
            </div>

            {/* Name */}
            <Link href={`/product/${product.slug}`}>
              <h3 className="text-xl font-bold text-white mb-2 hover:text-amber-300 transition-colors line-clamp-2">
                {product.name}
              </h3>
            </Link>

            {/* Rating */}
            {product.averageRating > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Icon.PiStarFill
                      key={i}
                      size={14}
                      className={i < Math.floor(product.averageRating) ? 'text-amber-400' : 'text-gray-500'}
                    />
                  ))}
                </div>
                <span className="text-amber-400 font-semibold text-sm">{product.averageRating.toFixed(1)}</span>
                <span className="text-gray-400 text-sm">({product.reviewCount})</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-black text-white">₦{product.price.toLocaleString()}</span>
              {product.sale && (
                <>
                  <span className="text-sm text-gray-400 line-through">₦{product.originPrice.toLocaleString()}</span>
                  <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-lg">-{product.discount}%</span>
                </>
              )}
            </div>

            {/* Size Selector */}
            {product.sizes && product.sizes.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {product.sizes.slice(0, 4).map((size) => (
                  <button
                    key={size._id}
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-1 text-xs font-medium rounded-lg transition-all ${
                      selectedSize?._id === size._id
                        ? 'bg-white text-gray-900'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {size.size}
                  </button>
                ))}
                {product.sizes.length > 4 && (
                  <span className="px-2 py-1 text-xs text-white/50">
                    +{product.sizes.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-300 mb-1.5">
                <span>{soldPercentage}% sold</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                  style={{ width: `${soldPercentage}%` }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (inCart && onRemoveFromCart) {
                    onRemoveFromCart();
                  } else {
                    onAddToCart(selectedSize || undefined);
                  }
                }}
                disabled={addingToCart}
                className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  addingToCart
                    ? 'bg-emerald-500 text-white'
                    : inCart
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-white text-gray-900 hover:bg-amber-500 hover:text-white'
                }`}
              >
                {addingToCart ? (
                  <Icon.PiSpinner size={18} className="animate-spin" />
                ) : inCart ? (
                  <>
                    <Icon.PiTrash size={18} />
                    Remove
                  </>
                ) : (
                  <>
                    <Icon.PiShoppingCart size={18} />
                    Add to Cart
                  </>
                )}
              </button>
              <Link
                href={`/product/${product.slug}`}
                className="px-4 py-3 bg-white/20 backdrop-blur-sm rounded-xl text-white hover:bg-white/30 transition-all flex items-center justify-center"
              >
                <Icon.PiArrowRight size={20} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
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
  onAddToCart: (size?: ProductSize) => void;
  onWishlistToggle: () => void;
  onRemoveFromCart?: () => void;
  addingToCart: boolean;
  wishlistAdding: boolean;
  inWishlist: boolean;
  inCart: boolean;
  cartQty: number;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(product.sizes?.[0] || null);
  
  const mainImage = product.thumbImage?.[0] || product.primaryImage?.url;
  const rank = index + 2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative group"
    >
      <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-gray-100">
        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
          <Link href={`/product/${product.slug}`}>
            <div className="relative w-full h-full">
              {!imgError && mainImage ? (
                <img
                  src={mainImage}
                  alt={product.name}
                  className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ${
                    isHovered ? 'scale-110' : 'scale-100'
                  }`}
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                  <span className="text-4xl opacity-30">🍷</span>
                </div>
              )}
            </div>
          </Link>

          {/* Rank Badge */}
          <div className="absolute top-3 left-3 z-10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shadow-lg ${
              rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
              rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
              'bg-white text-gray-700'
            }`}>
              {rank}
            </div>
          </div>

          {/* Sale Badge */}
          {product.sale && (
            <div className="absolute top-3 right-3 z-10">
              <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-lg">
                -{product.discount}%
              </div>
            </div>
          )}

          {/* Wishlist Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onWishlistToggle}
            disabled={wishlistAdding}
            className={`absolute bottom-3 left-3 z-20 w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all ${
              wishlistAdding
                ? 'bg-gray-400'
                : inWishlist
                  ? 'bg-red-500 text-white'
                  : 'bg-white/95 text-gray-500 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            {wishlistAdding ? (
              <Icon.PiSpinner size={16} className="animate-spin" />
            ) : inWishlist ? (
              <Icon.PiHeartFill size={16} />
            ) : (
              <Icon.PiHeart size={16} />
            )}
          </motion.button>

          {/* Quick Add */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
            className="absolute bottom-3 right-3 z-20"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={(e) => {
                e.preventDefault();
                if (inCart && onRemoveFromCart) {
                  onRemoveFromCart();
                } else {
                  onAddToCart(selectedSize || undefined);
                }
              }}
              disabled={addingToCart}
              className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all ${
                addingToCart
                  ? 'bg-emerald-500 text-white'
                  : inCart
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              {addingToCart ? (
                <Icon.PiSpinner size={16} className="animate-spin" />
              ) : inCart ? (
                <Icon.PiTrash size={16} />
              ) : (
                <Icon.PiPlus size={16} />
              )}
            </motion.button>
          </motion.div>
        </div>

        {/* Content */}
        <div className="p-4">
          {product.category && (
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
              {product.category.name}
            </span>
          )}
          
          <Link href={`/product/${product.slug}`}>
            <h3 className="font-bold text-gray-900 text-sm line-clamp-2 hover:text-amber-600 transition-colors mt-1 min-h-[2.5rem]">
              {product.name}
            </h3>
          </Link>

          {product.tenant && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Icon.PiStorefront size={10} />
              <span className="truncate">{product.tenant.name}</span>
            </div>
          )}

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

          {/* Price */}
          <div className="mt-2 flex items-end gap-2">
            <span className="text-base font-black text-gray-900">
              ₦{product.price.toLocaleString()}
            </span>
            {product.sale && (
              <span className="text-xs text-gray-400 line-through">
                ₦{product.originPrice.toLocaleString()}
              </span>
            )}
          </div>

          {/* In Cart */}
          {inCart && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-2 flex items-center justify-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-xs font-semibold"
            >
              <Icon.PiShoppingCart size={12} />
              {cartQty} in cart
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const BestSellers: React.FC<BestSellersProps> = ({ limit = 5 }) => {
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
    const fetchBestSellers = async () => {
      try {
        setLoading(true);
        const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
        const response = await fetch(`${API_URL}/api/products?sort=rating&limit=${limit}`);
        
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const data = await response.json();
        const mappedProducts = (data.data?.products || data.products || []).map(mapApiProductToProduct);
        setProducts(mappedProducts);
      } catch (err) {
        console.error('Error fetching best sellers:', err);
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };

    fetchBestSellers();
  }, [limit]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isProductInCart = useCallback((product: Product) => {
    const tenantName = product.tenant?.name || 'default';
    const size = product.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    return cartState.cartArray.some(item => item.cartItemId === cartItemId);
  }, [cartState.cartArray]);

  const getCartQuantity = useCallback((product: Product) => {
    const tenantName = product.tenant?.name || 'default';
    const size = product.sizes?.[0]?.size || 'default';
    const cartItemId = `${product._id}-${size}-${tenantName}-default`;
    const cartItem = cartState.cartArray.find(item => item.cartItemId === cartItemId);
    return cartItem?.quantity || 0;
  }, [cartState.cartArray]);

  const isProductInWishlist = useCallback((product: Product) => {
    return wishlistState.wishlistArray.some(item => item.id === product._id || item._id === product._id);
  }, [wishlistState.wishlistArray]);

  const handleAddToCart = async (product: Product, selectedSize?: ProductSize) => {
    setAddingToCart(product._id);
    try {
      const availableAt = product.availableAt?.[0];
      const sizeData = selectedSize || product.sizes?.[0];
      const size = sizeData?.size || product.defaultSize || 'Default';
      const tenantName = product.tenant?.name || availableAt?.tenant?.name || '';
      const tenantId = product.tenant?._id || availableAt?.tenant?._id || '';
      
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
      
      showToast(existingItem ? `Quantity increased!` : `${product.name} added!`, 'success');
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
      <section className="py-16 sm:py-24 bg-gradient-to-b from-white to-amber-50/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 rounded-full text-xs font-bold text-amber-700 mb-4">
              <Icon.PiCrownFill size={14} />
              Top Rated
            </div>
            <div className="h-12 bg-gray-200 rounded-xl w-56 mx-auto animate-pulse" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 aspect-square bg-gray-200 rounded-3xl animate-pulse" />
            <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="aspect-square bg-gray-200 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error || products.length === 0) return null;

  const featuredProduct = products[0];
  const otherProducts = products.slice(1, limit);
  const totalReviews = products.reduce((sum, p) => sum + p.reviewCount, 0);

  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-white via-amber-50/20 to-white overflow-hidden">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl shadow-xl flex items-center gap-2.5 text-white ${
              toast.type === 'success' ? 'bg-amber-500' : 'bg-red-500'
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-100 to-orange-100 rounded-full text-xs font-bold text-amber-700 mb-4 shadow-sm"
          >
            <Icon.PiCrownFill size={14} className="text-amber-500" />
            Top Rated
          </motion.div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 mb-4">
            Best<span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent"> Sellers</span>
          </h2>
          
          <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
            Discover our customers' absolute favorites - the products everyone loves
          </p>

          {/* Stats */}
          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Icon.PiTrophy size={18} className="text-amber-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">{products.length}</div>
                <div className="text-xs text-gray-500">Top Picks</div>
              </div>
            </div>
            <div className="w-px h-10 bg-gray-200" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center">
                <Icon.PiStar size={18} className="text-yellow-600" />
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900">{totalReviews.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Reviews</div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Featured Product */}
          {featuredProduct && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:col-span-1"
            >
              <FeaturedProductCard
                product={featuredProduct}
                onAddToCart={() => handleAddToCart(featuredProduct)}
                onWishlistToggle={() => handleWishlistToggle(featuredProduct)}
                onRemoveFromCart={() => handleRemoveFromCart(featuredProduct)}
                addingToCart={addingToCart === featuredProduct._id}
                wishlistAdding={wishlistAdding === featuredProduct._id}
                inWishlist={isProductInWishlist(featuredProduct)}
                inCart={isProductInCart(featuredProduct)}
                cartQty={getCartQuantity(featuredProduct)}
              />
            </motion.div>
          )}

          {/* Other Products */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-5">
            {otherProducts.map((product, index) => (
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
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Link
            href="/shop?sort=rating"
            className="inline-flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-full hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl"
          >
            View All Best Sellers
            <Icon.PiArrowRight size={20} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default BestSellers;
