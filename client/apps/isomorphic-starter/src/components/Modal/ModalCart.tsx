'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';

const ModalCart = () => {
  const { isModalOpen, closeModalCart } = useModalCartContext();
  const { cartState, updateQuantity, removeFromCart, cartTotal, cartCount, clearCart } = useCart();
  const { addToWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [note, setNote] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);

  const shipping = cartTotal > 50000 ? 0 : 2500;
  const remainingForFree = Math.max(0, 50000 - cartTotal);
  const freeShippingProgress = Math.min(100, (cartTotal / 50000) * 100);

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModalCart();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, closeModalCart]);

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

  const formatPrice = (price: number) => {
    return '₦' + price.toLocaleString();
  };

  const handleQuantityChange = async (cartItemId: string, newQuantity: number) => {
    setUpdatingId(cartItemId);
    if (newQuantity <= 0) {
      await handleRemove(cartItemId);
    } else {
      updateQuantity(cartItemId, newQuantity);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setUpdatingId(null);
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
    closeModalCart();
    openModalWishlist();
  };

  const handleClearCart = async () => {
    const allIds = cartState.cartArray.map(item => item.cartItemId);
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
    closeModalCart();
    router.push('/checkout');
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
            onClick={closeModalCart}
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <Icon.PiShoppingCart className="text-green-600" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Shopping Cart</h2>
                  <p className="text-sm text-gray-500">
                    {cartCount} {cartCount === 1 ? 'item' : 'items'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cartCount > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-red-100 hover:text-red-500 transition-all duration-200"
                    title="Clear cart"
                  >
                    <Icon.PiTrash size={18} />
                  </button>
                )}
                <button
                  onClick={closeModalCart}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-all duration-200 hover:rotate-90"
                  aria-label="Close cart"
                >
                  <Icon.PiX size={20} />
                </button>
              </div>
            </div>

            {/* Free Shipping Progress */}
            {cartCount > 0 && (
              <div className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
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
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2 text-green-600"
                  >
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                    >
                      <Icon.PiCheckCircle size={24} />
                    </motion.div>
                    <span className="font-semibold">You unlocked FREE shipping!</span>
                  </motion.div>
                )}
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {cartCount === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center h-full px-6 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', delay: 0.2 }}
                    className="w-28 h-28 rounded-full bg-gray-100 flex items-center justify-center mb-6"
                  >
                    <Icon.PiShoppingCart size={56} className="text-gray-300" />
                  </motion.div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
                  <p className="text-gray-500 mb-8">Add some delicious drinks to get started!</p>
                  <button
                    onClick={closeModalCart}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Icon.PiShoppingBag size={20} />
                    Continue Shopping
                  </button>
                </motion.div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <AnimatePresence mode="popLayout">
                    {cartState.cartArray.map((item, index) => {
                      const isRemoving = removingId === item.cartItemId;
                      const isUpdating = updatingId === item.cartItemId;

                      return (
                        <motion.div
                          key={item.cartItemId}
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
                            <Link
                              href={`/product/${item.slug}`}
                              onClick={closeModalCart}
                              className="relative w-24 h-24 flex-shrink-0"
                            >
                              <div className="w-full h-full rounded-xl overflow-hidden bg-gray-100">
                                {getItemImage(item) ? (
                                  <Image
                                    src={getItemImage(item)}
                                    alt={item.name}
                                    fill
                                    className="object-cover hover:scale-105 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Icon.PiImage size={32} className="text-gray-300" />
                                  </div>
                                )}
                              </div>
                            </Link>

                            {/* Product Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  href={`/product/${item.slug}`}
                                  onClick={closeModalCart}
                                  className="font-semibold text-gray-900 text-sm line-clamp-2 hover:text-green-600 transition-colors"
                                >
                                  {item.name}
                                </Link>
                                <button
                                  onClick={() => handleRemove(item.cartItemId)}
                                  disabled={isRemoving}
                                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-all duration-200 flex-shrink-0"
                                >
                                  <Icon.PiX size={16} />
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
                              <div className="flex items-center justify-between mt-3">
                                {/* Quantity Controls */}
                                <div className={`flex items-center border border-gray-200 rounded-lg overflow-hidden transition-opacity duration-200 ${isUpdating ? 'opacity-50' : ''}`}>
                                  <button
                                    onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) - 1)}
                                    disabled={(item.quantity || 1) <= 1 || isUpdating}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Icon.PiMinusBold size={12} />
                                  </button>
                                  <span className="w-10 text-center text-sm font-semibold">
                                    {isUpdating ? (
                                      <motion.div
                                        animate={{ rotate: 360 }}
                                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                        className="inline-block"
                                      >
                                        <Icon.PiSpinner size={14} />
                                      </motion.div>
                                    ) : (
                                      item.quantity || 1
                                    )}
                                  </span>
                                  <button
                                    onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) + 1)}
                                    disabled={(item.quantity || 1) >= 99 || isUpdating}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Icon.PiPlusBold size={12} />
                                  </button>
                                </div>

                                {/* Price */}
                                <span className="font-bold text-gray-900">
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
              )}
            </div>

            {/* Footer */}
            {cartCount > 0 && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="border-t border-gray-100 bg-gray-50"
              >
                {/* Order Note */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-green-600 transition-colors">
                    <Icon.PiNotePencil size={18} />
                    <span>Add Order Note</span>
                  </button>
                  <AnimatePresence>
                    {note !== undefined && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Add special instructions..."
                          className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          rows={2}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Summary */}
                <div className="p-6 space-y-3">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span>
                    <span className="font-medium">{formatPrice(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Shipping</span>
                    <span className="font-medium">
                      {shipping === 0 ? (
                        <span className="text-green-600">Free</span>
                      ) : (
                        formatPrice(shipping)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold text-gray-900">
                      {formatPrice(cartTotal + shipping)}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3 pt-2">
                    <button
                      onClick={handleCheckout}
                      className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all duration-300 hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <Icon.PiLockKey size={20} />
                      Proceed to Checkout
                    </button>
                    <Link
                      href="/cart"
                      onClick={closeModalCart}
                      className="w-full py-3.5 bg-white border-2 border-gray-900 text-gray-900 font-semibold rounded-xl hover:bg-gray-900 hover:text-white transition-all duration-300 text-center block"
                    >
                      View Full Cart
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* Clear Cart Confirmation */}
          <AnimatePresence>
            {showClearConfirm && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
                  onClick={() => setShowClearConfirm(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 max-w-md w-full mx-4 z-[70] shadow-2xl"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Icon.PiWarning size={32} className="text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Clear Cart?</h3>
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
        </>
      )}
    </AnimatePresence>
  );
};

export default ModalCart;
