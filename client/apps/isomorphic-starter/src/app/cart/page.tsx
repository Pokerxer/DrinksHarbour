'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';

const CartPage = () => {
  const router = useRouter();
  const { cartState, updateQuantity, removeFromCart, cartTotal, cartCount, clearCart } = useCart();
  const { addToWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const shipping = useMemo(() => cartTotal > 50000 ? 0 : 2500, [cartTotal]);
  const remainingForFree = useMemo(() => Math.max(0, 50000 - cartTotal), [cartTotal]);
  const freeShippingProgress = useMemo(() => Math.min(100, (cartTotal / 50000) * 100), [cartTotal]);

  const formatPrice = (price: number) => {
    return '₦' + price.toLocaleString();
  };

  const handleQuantityChange = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemove(cartItemId);
    } else {
      updateQuantity(cartItemId, newQuantity);
    }
  };

  const handleRemove = async (cartItemId: string) => {
    setRemovingId(cartItemId);
    await new Promise(resolve => setTimeout(resolve, 300));
    removeFromCart(cartItemId);
    setRemovingId(null);
  };

  const handleMoveToWishlist = (item: any) => {
    addToWishlist(item);
    removeFromCart(item.cartItemId);
  };

  const handleClearCart = async () => {
    setRemovingId('all');
    await new Promise(resolve => setTimeout(resolve, 300));
    clearCart();
    setRemovingId(null);
    setShowClearConfirm(false);
  };

  const getItemImage = (item: any) => {
    if (item.primaryImage?.url) return item.primaryImage.url;
    if (item.thumbImage?.[0]) return item.thumbImage[0];
    if (item.images?.[0]?.url) return item.images[0].url;
    return null;
  };

  const handleCheckout = () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (!token) {
      router.push('/login?redirect=/checkout');
      return;
    }
    
    router.push('/checkout');
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
      </div>
    );
  }

  if (cartCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
          <div className="text-center py-12 sm:py-20">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6"
            >
              <Icon.PiShoppingCart size={48} className="text-gray-300 sm:w-14 sm:h-14" />
            </motion.div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Your cart is empty</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto px-4">
              Looks like you haven&apos;t added anything to your cart yet. Start shopping to fill it up!
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Icon.PiStorefront size={20} />
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-green-100 flex items-center justify-center">
              <Icon.PiShoppingCart className="text-green-600 w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Shopping Cart</h1>
              <p className="text-sm text-gray-500">
                {cartCount} {cartCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowClearConfirm(true)}
            className="text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
          >
            <Icon.PiTrash size={16} />
            <span className="hidden sm:inline">Clear All</span>
          </button>
        </div>

        {/* Free Shipping Progress */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl sm:rounded-2xl p-4 mb-6 border border-green-100">
          {remainingForFree > 0 ? (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-600">
                  Add <span className="font-bold text-green-600">{formatPrice(remainingForFree)}</span> for FREE shipping
                </span>
                <span className="text-green-600 font-medium">{Math.round(freeShippingProgress)}%</span>
              </div>
              <div className="w-full h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: freeShippingProgress + '%' }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-green-600">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Icon.PiCheckCircle size={24} />
              </motion.div>
              <span className="font-semibold">You unlocked FREE shipping!</span>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Cart Items */}
          <div className="flex-1">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <AnimatePresence mode="popLayout">
                {cartState.cartArray.map((item, index) => {
                  const isRemoving = removingId === item.cartItemId;
                  const imageUrl = getItemImage(item);

                  return (
                    <motion.div
                      key={item.cartItemId}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{
                        opacity: isRemoving ? 0 : 1,
                        y: isRemoving ? -20 : 0,
                        scale: isRemoving ? 0.95 : 1
                      }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      className={`p-3 sm:p-4 ${index > 0 ? 'border-t border-gray-100' : ''}`}
                    >
                      <div className="flex gap-3 sm:gap-4">
                        {/* Product Image */}
                        <Link
                          href={`/product/${item.slug}`}
                          className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0"
                        >
                          <div className="w-full h-full rounded-xl overflow-hidden bg-gray-100">
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={item.name}
                                fill
                                className="object-cover hover:scale-105 transition-transform duration-300"
                                sizes="96px"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Icon.PiImage size={24} className="text-gray-300" />
                              </div>
                            )}
                          </div>
                        </Link>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <Link
                              href={`/product/${item.slug}`}
                              className="font-semibold text-gray-900 text-sm sm:text-base line-clamp-2 hover:text-green-600 transition-colors"
                            >
                              {item.name}
                            </Link>
                            <button
                              onClick={() => handleRemove(item.cartItemId)}
                              disabled={isRemoving}
                              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-all duration-200 flex-shrink-0"
                            >
                              <Icon.PiX size={14} />
                            </button>
                          </div>

                          {/* Vendor & Size Tags */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            {item.selectedVendor && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded">
                                <Icon.PiStorefront size={10} />
                                {item.selectedVendor}
                              </span>
                            )}
                            {item.selectedSize && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                {item.selectedSize}
                              </span>
                            )}
                          </div>

                          {/* Price & Quantity */}
                          <div className="flex items-center justify-between mt-2 sm:mt-3">
                            {/* Quantity Controls */}
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) - 1)}
                                disabled={(item.quantity || 1) <= 1}
                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                              >
                                <Icon.PiMinusBold size={12} />
                              </button>
                              <span className="w-10 text-center text-sm font-semibold">
                                {item.quantity || 1}
                              </span>
                              <button
                                onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) + 1)}
                                disabled={(item.quantity || 1) >= 99}
                                className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
                              >
                                <Icon.PiPlusBold size={12} />
                              </button>
                            </div>

                            {/* Price */}
                            <span className="font-bold text-gray-900 text-sm sm:text-base">
                              {formatPrice((item.price || 0) * (item.quantity || 1))}
                            </span>
                          </div>

                          {/* Move to Wishlist */}
                          <button
                            onClick={() => handleMoveToWishlist(item)}
                            className="mt-2 text-xs text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                          >
                            <Icon.PiHeart size={12} />
                            Move to Wishlist
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Continue Shopping */}
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 mt-4 text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Icon.PiArrowLeft size={16} />
              Continue Shopping
            </Link>
          </div>

          {/* Order Summary */}
          <div className="lg:w-80">
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 sticky top-4">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order Summary</h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal ({cartCount} items)</span>
                  <span className="font-medium">{formatPrice(cartTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span className="font-medium">
                    {shipping === 0 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      formatPrice(shipping)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Tax</span>
                  <span>Calculated at checkout</span>
                </div>
              </div>

              <div className="border-t border-gray-100 my-4"></div>

              <div className="flex justify-between text-base font-bold mb-6">
                <span>Total</span>
                <span>{formatPrice(cartTotal + shipping)}</span>
              </div>

              <button
                onClick={handleCheckout}
                className="w-full py-3 sm:py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                <Icon.PiLockKey size={18} />
                Proceed to Checkout
              </button>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
                <Icon.PiLock size={14} />
                <span>Secure checkout</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clear Cart Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
              onClick={() => setShowClearConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full mx-4 z-50 shadow-2xl"
            >
              <div className="text-center">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Icon.PiWarning size={28} className="text-red-500 sm:w-8 sm:h-8" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Clear Cart?</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to remove all {cartCount} items from your cart?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearCart}
                    className="flex-1 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CartPage;
