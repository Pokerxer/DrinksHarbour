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
  const { wishlistState, removeFromWishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addingToCartId, setAddingToCartId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModalWishlist();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, closeModalWishlist]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen]);

  const getImageUrl = (img: any): string => {
    if (!img) return '';
    if (typeof img === 'string') return img.trim() || '';
    if (typeof img === 'object' && img.url) return img.url.trim() || '';
    return '';
  };

  const getProductImage = (product: any) => {
    const thumbUrl = getImageUrl(product.thumbImage?.[0]);
    if (thumbUrl) return thumbUrl;
    
    const imgUrl = getImageUrl(product.images?.[0]);
    if (imgUrl) return imgUrl;
    
    return '/images/placeholder-product.png';
  };

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 300));
    removeFromWishlist(productId);
    setRemovingId(null);
  };

  const handleAddToCart = async (product: any) => {
    setAddingToCartId(product.id);
    
    // Add to cart logic
    addToCart(product);
    
    // Small delay for animation
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setAddingToCartId(null);
    closeModalWishlist();
    openModalCart();
  };

  const handleViewProduct = (slug: string) => {
    closeModalWishlist();
    router.push(`/product/${slug}`);
  };

  // Calculate savings
  const getSavings = (product: any) => {
    if (product.originPrice && product.originPrice > product.price) {
      return product.originPrice - product.price;
    }
    return 0;
  };

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

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                  <Icon.PiHeartFill className="text-red-500" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">My Wishlist</h2>
                  <p className="text-sm text-gray-500">
                    {wishlistState.wishlistArray.length} {wishlistState.wishlistArray.length === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModalWishlist}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all duration-200 hover:rotate-90"
                aria-label="Close wishlist"
              >
                <Icon.PiX size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {wishlistState.wishlistArray.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full px-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center mb-6"
                  >
                    <Icon.PiHeart size={48} className="text-gray-300" />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Your wishlist is empty</h3>
                  <p className="text-gray-500 mb-8">Save your favorite items to purchase later.</p>
                  <Link
                    href="/shop"
                    onClick={closeModalWishlist}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Icon.PiShoppingBag size={20} />
                    Start Shopping
                  </Link>
                </motion.div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <AnimatePresence mode="popLayout">
                    {wishlistState.wishlistArray.map((product, index) => {
                      const savings = getSavings(product);
                      const isRemoving = removingId === product.id;
                      const isAddingToCart = addingToCartId === product.id;

                      return (
                        <motion.div
                          key={product.id}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ 
                            opacity: isRemoving ? 0 : 1, 
                            x: isRemoving ? 100 : 0,
                            scale: isRemoving ? 0.9 : 1
                          }}
                          exit={{ opacity: 0, x: 100, scale: 0.9 }}
                          transition={{ delay: index * 0.05 }}
                          className="p-4 hover:bg-gray-50 transition-colors duration-200"
                        >
                          <div className="flex gap-4">
                            {/* Product Image */}
                            <div 
                              className="relative w-24 h-24 flex-shrink-0 cursor-pointer group"
                              onClick={() => handleViewProduct(product.slug)}
                            >
                              <Image
                                src={getProductImage(product)}
                                fill
                                alt={product.name}
                                className="object-cover rounded-lg group-hover:scale-105 transition-transform duration-300"
                              />
                              {savings > 0 && (
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                  -{Math.round((savings / product.originPrice) * 100)}%
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <h3 
                                className="font-semibold text-gray-900 mb-1 line-clamp-2 cursor-pointer hover:text-red-600 transition-colors"
                                onClick={() => handleViewProduct(product.slug)}
                              >
                                {product.name}
                              </h3>
                              
                              {/* Price */}
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg font-bold text-gray-900">
                                  ${product.price?.toFixed(2)}
                                </span>
                                {product.originPrice > product.price && (
                                  <>
                                    <span className="text-sm text-gray-400 line-through">
                                      ${product.originPrice?.toFixed(2)}
                                    </span>
                                    <span className="text-xs text-red-500 font-medium">
                                      Save ${savings.toFixed(2)}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleAddToCart(product)}
                                  disabled={isAddingToCart}
                                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 ${
                                    isAddingToCart
                                      ? 'bg-gray-100 text-gray-400'
                                      : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-md'
                                  }`}
                                >
                                  {isAddingToCart ? (
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                    >
                                      <Icon.PiSpinner size={16} />
                                    </motion.div>
                                  ) : (
                                    <Icon.PiShoppingCart size={16} />
                                  )}
                                  {isAddingToCart ? 'Adding...' : 'Add to Cart'}
                                </button>

                                <button
                                  onClick={() => handleRemove(product.id)}
                                  disabled={isRemoving}
                                  className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-all duration-200 hover:scale-110"
                                  title="Remove from wishlist"
                                >
                                  <Icon.PiTrash size={18} />
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
            {wishlistState.wishlistArray.length > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="border-t border-gray-100 p-6 bg-gray-50"
              >
                <div className="space-y-3">
                  <Link
                    href="/wishlist"
                    onClick={closeModalWishlist}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-gray-900 text-gray-900 font-semibold rounded-lg hover:bg-gray-900 hover:text-white transition-all duration-300"
                  >
                    <Icon.PiHeart size={18} />
                    View Full Wishlist
                  </Link>
                  
                  <button
                    onClick={closeModalWishlist}
                    className="w-full text-center text-gray-500 hover:text-gray-900 transition-colors text-sm"
                  >
                    Continue Shopping
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ModalWishlist;
