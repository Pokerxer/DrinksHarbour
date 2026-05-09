'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';

const ModalWishlist = () => {
  const { isModalOpen, closeModalWishlist } = useModalWishlistContext();
  const { wishlistState, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) closeModalWishlist();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, closeModalWishlist]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const formatPrice = (price: number) => '₦' + price.toLocaleString();

  const getImageUrl = (img: any): string => {
    if (!img) return '';
    if (typeof img === 'string') return img.trim();
    if (typeof img === 'object' && img.url) return img.url.trim();
    return '';
  };

  const getProductImage = (product: any): string => {
    // Prefer primaryImage (API shape)
    if (product.primaryImage?.url) return product.primaryImage.url;
    const thumbUrl = getImageUrl(product.thumbImage?.[0]);
    if (thumbUrl) return thumbUrl;
    const imgUrl = getImageUrl(product.images?.[0]);
    if (imgUrl) return imgUrl;
    return '/images/images/product/1000x1000.png';
  };

  // Resolve the best available price from multiple possible shapes
  const getPrice = (product: any): number => {
    return product.price || product.priceRange?.min || product.minWebsitePrice || 0;
  };

  const getOriginalPrice = (product: any): number => {
    return product.originPrice || product.originalMinPrice || product.priceRange?.originalMin || 0;
  };

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    await new Promise(resolve => setTimeout(resolve, 300));
    removeFromWishlist(productId);
    setRemovingId(null);
  };

  const handleAddToCart = async (product: any) => {
    setAddingToCartId(product.id || product._id);
    addToCart(product);
    await new Promise(resolve => setTimeout(resolve, 400));
    setAddingToCartId(null);
    closeModalWishlist();
    openModalCart();
  };

  const handleViewProduct = (slug: string) => {
    closeModalWishlist();
    router.push(`/product/${slug}`);
  };

  const wishlistCount = wishlistState.wishlistArray.length;

  return (
    <AnimatePresence>
      {isModalOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={closeModalWishlist}
          />

          {/* Drawer */}
          <motion.div
            ref={modalRef}
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-red-700 to-red-900">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
                  <Icon.PiHeartFill className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">My Wishlist</h2>
                  <p className="text-xs text-red-200">
                    {wishlistCount} {wishlistCount === 1 ? 'item' : 'items'} saved
                  </p>
                </div>
              </div>
              <button
                onClick={closeModalWishlist}
                className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all hover:rotate-90"
                aria-label="Close wishlist"
              >
                <Icon.PiX size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {wishlistCount === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full px-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-28 h-28 rounded-full bg-red-50 flex items-center justify-center mb-6"
                  >
                    <Icon.PiHeart size={52} className="text-red-200" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Your wishlist is empty</h3>
                  <p className="text-gray-500 text-sm mb-8">Save your favourite drinks to purchase later.</p>
                  <Link
                    href="/shop"
                    onClick={closeModalWishlist}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white font-semibold rounded-full hover:from-red-800 hover:to-red-950 transition-all hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Icon.PiShoppingBag size={18} />
                    Start Shopping
                  </Link>
                </motion.div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <AnimatePresence mode="popLayout">
                    {wishlistState.wishlistArray.map((product, index) => {
                      const price = getPrice(product);
                      const originalPrice = getOriginalPrice(product);
                      const hasSaving = originalPrice > 0 && originalPrice > price;
                      const savingPct = hasSaving ? Math.round((1 - price / originalPrice) * 100) : 0;
                      const isRemoving = removingId === (product.id || (product as any)._id);
                      const isAddingToCart = addingToCartId === (product.id || (product as any)._id);
                      const imgSrc = getProductImage(product);

                      return (
                        <motion.div
                          key={product.id || (product as any)._id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: isRemoving ? 0 : 1, x: isRemoving ? 100 : 0, scale: isRemoving ? 0.9 : 1 }}
                          exit={{ opacity: 0, x: 100, scale: 0.9 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex gap-4">
                            {/* Image */}
                            <div
                              className="relative w-24 h-24 flex-shrink-0 cursor-pointer group"
                              onClick={() => handleViewProduct(product.slug)}
                            >
                              <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 border border-gray-100">
                                <Image
                                  src={imgSrc}
                                  fill
                                  alt={product.name}
                                  className="object-contain group-hover:scale-105 transition-transform duration-300 p-1"
                                  sizes="96px"
                                />
                              </div>
                              {savingPct > 0 && (
                                <div className="absolute -top-2 -right-2 w-9 h-9 bg-gradient-to-br from-red-600 to-red-800 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-md">
                                  -{savingPct}%
                                </div>
                              )}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <h3
                                className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2 cursor-pointer hover:text-red-700 transition-colors"
                                onClick={() => handleViewProduct(product.slug)}
                              >
                                {product.name}
                              </h3>

                              {/* Price */}
                              <div className="flex items-center gap-2 mb-3">
                                {price > 0 ? (
                                  <>
                                    <span className="text-base font-bold text-gray-900">
                                      {formatPrice(price)}
                                    </span>
                                    {hasSaving && (
                                      <>
                                        <span className="text-xs text-gray-400 line-through">
                                          {formatPrice(originalPrice)}
                                        </span>
                                        <span className="text-xs text-red-600 font-semibold bg-red-50 px-1.5 py-0.5 rounded">
                                          Save {formatPrice(originalPrice - price)}
                                        </span>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-gray-400 italic">Price not available</span>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={isAddingToCart}
                                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-semibold text-xs transition-all ${
                                    isAddingToCart
                                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                      : 'bg-gradient-to-br from-red-700 to-red-900 text-white hover:from-red-800 hover:to-red-950 hover:shadow-md'
                                  }`}
                                >
                                  {isAddingToCart ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                      <Icon.PiSpinner size={14} />
                                    </motion.div>
                                  ) : (
                                    <Icon.PiShoppingCart size={14} />
                                  )}
                                  {isAddingToCart ? 'Adding…' : 'Add to Cart'}
                                </button>

                                <button
                                  onClick={() => handleRemove(product.id || (product as any)._id)}
                                  disabled={isRemoving}
                                  className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 transition-all"
                                  title="Remove from wishlist"
                                >
                                  <Icon.PiTrash size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Footer */}
            {wishlistCount > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="border-t border-gray-100 p-5 bg-gray-50 space-y-2.5"
              >
                <Link
                  href="/wishlist"
                  onClick={closeModalWishlist}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl hover:from-red-800 hover:to-red-950 transition-all hover:shadow-lg text-sm"
                >
                  <Icon.PiHeart size={16} />
                  View Full Wishlist
                </Link>
                <button
                  onClick={closeModalWishlist}
                  className="w-full text-center text-gray-400 hover:text-gray-700 transition-colors text-sm"
                >
                  Continue Shopping
                </button>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ModalWishlist;
