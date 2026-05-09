'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  const {
    cartState, updateQuantity, removeFromCart, cartTotal, cartCount, clearCart,
    validationMap, validating, validateCartItems, applyValidationUpdates,
  } = useCart();
  const { addToWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [note, setNote] = useState('');
  const [appliedUpdates, setAppliedUpdates] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const shipping = useMemo(() => cartTotal > 50000 ? 0 : 2500, [cartTotal]);
  const remainingForFree = useMemo(() => Math.max(0, 50000 - cartTotal), [cartTotal]);
  const freeShippingProgress = useMemo(() => Math.min(100, (cartTotal / 50000) * 100), [cartTotal]);

  // Trigger validation every time the cart opens
  useEffect(() => {
    if (isModalOpen && cartCount > 0) {
      setAppliedUpdates(false);
      validateCartItems();
    }
  }, [isModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) closeModalCart();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isModalOpen, closeModalCart]);

  useEffect(() => {
    document.body.style.overflow = isModalOpen ? 'hidden' : 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isModalOpen]);

  const formatPrice = (price: number) => '₦' + price.toLocaleString();

  // How many items have validation issues
  const issueCount = useMemo(() => {
    return Object.values(validationMap).filter(v => v.status !== 'ok').length;
  }, [validationMap]);

  const outOfStockCount = useMemo(() => {
    return Object.values(validationMap).filter(v => !v.available).length;
  }, [validationMap]);

  const priceChangedCount = useMemo(() => {
    return Object.values(validationMap).filter(v => v.status === 'price_changed').length;
  }, [validationMap]);

  // Get validation info for a single item
  const getValidation = (item: any) => {
    const key = `${item.selectedSubProductId}-${item.selectedSizeId ?? ''}`;
    return validationMap[key] ?? null;
  };

  const handleQuantityChange = (cartItemId: string, newQuantity: number) => {
    if (newQuantity <= 0) handleRemove(cartItemId);
    else updateQuantity(cartItemId, newQuantity);
  };

  const handleRemove = async (cartItemId: string) => {
    setRemovingId(cartItemId);
    await new Promise(resolve => setTimeout(resolve, 300));
    removeFromCart(cartItemId);
    setRemovingId(null);
  };

  const handleRemoveAllOutOfStock = () => {
    cartState.cartArray.forEach(item => {
      const v = getValidation(item);
      if (v && !v.available) removeFromCart(item.cartItemId);
    });
  };

  const handleAcceptUpdates = () => {
    applyValidationUpdates();
    setAppliedUpdates(true);
  };

  const handleMoveToWishlist = (item: any) => {
    addToWishlist(item);
    removeFromCart(item.cartItemId);
    closeModalCart();
    openModalWishlist();
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
    // Block checkout if there are unresolved issues
    if (issueCount > 0) return;
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    closeModalCart();
    router.push(token ? '/checkout' : '/login?redirect=/checkout');
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

          {/* Drawer */}
          <motion.div
            ref={modalRef}
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-red-700 to-red-900">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center">
                  <Icon.PiShoppingCartFill className="text-white" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Shopping Cart</h2>
                  <p className="text-xs text-red-200">
                    {cartCount} {cartCount === 1 ? 'item' : 'items'}
                    {validating && (
                      <span className="ml-2 inline-flex items-center gap-1 opacity-80">
                        <span className="w-2 h-2 bg-red-300 rounded-full animate-ping inline-block" />
                        Checking availability…
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {cartCount > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all"
                    title="Clear cart"
                  >
                    <Icon.PiTrash size={16} />
                  </button>
                )}
                <button
                  onClick={closeModalCart}
                  className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center text-white hover:bg-white/25 transition-all hover:rotate-90"
                  aria-label="Close cart"
                >
                  <Icon.PiX size={18} />
                </button>
              </div>
            </div>

            {/* Validation Banner */}
            <AnimatePresence>
              {!validating && issueCount > 0 && !appliedUpdates && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                    <div className="flex items-start gap-3">
                      <Icon.PiWarning size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-amber-800">
                          Your cart needs attention
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          {outOfStockCount > 0 && `${outOfStockCount} item${outOfStockCount > 1 ? 's' : ''} out of stock. `}
                          {priceChangedCount > 0 && `${priceChangedCount} item${priceChangedCount > 1 ? 's' : ''} have updated prices.`}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {outOfStockCount > 0 && (
                          <button
                            onClick={handleRemoveAllOutOfStock}
                            className="text-xs font-semibold text-red-700 bg-red-100 hover:bg-red-200 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Remove unavailable
                          </button>
                        )}
                        {priceChangedCount > 0 && (
                          <button
                            onClick={handleAcceptUpdates}
                            className="text-xs font-semibold text-amber-800 bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Accept prices
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Free Shipping Progress */}
            {cartCount > 0 && (
              <div className="px-6 py-3.5 bg-red-50 border-b border-red-100">
                {remainingForFree > 0 ? (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-gray-600">
                        Add <span className="font-bold text-red-700">{formatPrice(remainingForFree)}</span> more for FREE shipping
                      </span>
                      <span className="text-red-700 font-semibold">{Math.round(freeShippingProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-red-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: freeShippingProgress + '%' }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-red-600 to-red-700 rounded-full"
                      />
                    </div>
                  </div>
                ) : (
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex items-center gap-2 text-red-700 text-sm font-semibold"
                  >
                    <Icon.PiCheckCircleFill size={20} />
                    You unlocked FREE shipping!
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
                    className="w-28 h-28 rounded-full bg-red-50 flex items-center justify-center mb-6"
                  >
                    <Icon.PiShoppingCart size={52} className="text-red-200" />
                  </motion.div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h3>
                  <p className="text-gray-500 mb-8 text-sm">Add some great drinks to get started!</p>
                  <button
                    onClick={closeModalCart}
                    className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white font-semibold rounded-full hover:from-red-800 hover:to-red-950 transition-all hover:shadow-lg hover:-translate-y-0.5"
                  >
                    <Icon.PiShoppingBag size={18} />
                    Continue Shopping
                  </button>
                </motion.div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <AnimatePresence mode="popLayout">
                    {cartState.cartArray.map((item, index) => {
                      const isRemoving  = removingId === item.cartItemId;
                      const imgSrc      = getItemImage(item);
                      const validation  = getValidation(item);
                      const isOutOfStock   = validation?.status === 'out_of_stock' || validation?.status === 'unavailable';
                      const isPriceChanged = validation?.status === 'price_changed';
                      const isQtyReduced   = validation?.status === 'quantity_reduced';
                      const maxQty = validation?.maxQuantity ?? 99;

                      return (
                        <motion.div
                          key={item.cartItemId}
                          layout
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: isRemoving ? 0 : 1, x: isRemoving ? 100 : 0, scale: isRemoving ? 0.9 : 1 }}
                          exit={{ opacity: 0, x: 100, scale: 0.9 }}
                          transition={{ delay: index * 0.05 }}
                          className={`p-4 transition-colors ${isOutOfStock ? 'bg-red-50/60' : 'hover:bg-gray-50'}`}
                        >
                          <div className="flex gap-4">
                            {/* Image */}
                            <Link
                              href={`/product/${item.slug}`}
                              onClick={closeModalCart}
                              className={`relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0 ${isOutOfStock ? 'opacity-50' : ''}`}
                            >
                              <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-b from-gray-50 to-gray-100 border border-gray-100 flex items-center justify-center p-1">
                                {imgSrc ? (
                                  <Image
                                    src={imgSrc}
                                    alt={item.name}
                                    fill
                                    className="object-contain hover:scale-105 transition-transform duration-300 p-1"
                                    sizes="96px"
                                  />
                                ) : (
                                  <Icon.PiImage size={24} className="text-gray-300" />
                                )}
                              </div>
                            </Link>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <Link
                                  href={`/product/${item.slug}`}
                                  onClick={closeModalCart}
                                  className={`font-semibold text-sm line-clamp-2 transition-colors ${isOutOfStock ? 'text-gray-400' : 'text-gray-900 hover:text-red-700'}`}
                                >
                                  {item.name}
                                </Link>
                                <button
                                  onClick={() => handleRemove(item.cartItemId)}
                                  disabled={isRemoving}
                                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-all flex-shrink-0"
                                >
                                  <Icon.PiX size={14} />
                                </button>
                              </div>

                              {/* Vendor & Size Tags */}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {item.selectedVendor && (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
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

                              {/* Validation status badges */}
                              {isOutOfStock && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-100 px-2.5 py-1 rounded-lg w-fit">
                                  <Icon.PiWarningCircleFill size={13} />
                                  Out of stock — remove to continue
                                </div>
                              )}
                              {isPriceChanged && !appliedUpdates && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg w-fit border border-amber-200">
                                  <Icon.PiArrowsClockwise size={13} />
                                  Price updated:&nbsp;
                                  <span className="line-through text-gray-400">{formatPrice(validation!.oldPrice)}</span>
                                  &nbsp;→&nbsp;
                                  <span className={validation!.currentPrice > validation!.oldPrice ? 'text-red-600' : 'text-green-600'}>
                                    {formatPrice(validation!.currentPrice)}
                                  </span>
                                </div>
                              )}
                              {isQtyReduced && (
                                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg w-fit">
                                  <Icon.PiWarning size={13} />
                                  Only {maxQty} available
                                </div>
                              )}

                              {/* Quantity + Price */}
                              <div className={`flex items-center justify-between mt-3 ${isOutOfStock ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) - 1)}
                                    disabled={(item.quantity || 1) <= 1}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Icon.PiMinusBold size={11} />
                                  </button>
                                  <span className="w-10 text-center text-sm font-bold text-gray-900">
                                    {item.quantity || 1}
                                  </span>
                                  <button
                                    onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) + 1)}
                                    disabled={(item.quantity || 1) >= maxQty}
                                    title={maxQty < 99 ? `Max ${maxQty} available` : undefined}
                                    className="w-8 h-8 flex items-center justify-center hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  >
                                    <Icon.PiPlusBold size={11} />
                                  </button>
                                </div>
                                <div className="text-right">
                                  {isPriceChanged && !appliedUpdates && (
                                    <p className="text-xs text-gray-400 line-through">
                                      {formatPrice((validation!.oldPrice || 0) * (item.quantity || 1))}
                                    </p>
                                  )}
                                  <span className={`font-bold ${isPriceChanged && !appliedUpdates ? (validation!.currentPrice > validation!.oldPrice ? 'text-red-600' : 'text-green-600') : 'text-gray-900'}`}>
                                    {formatPrice((isPriceChanged && !appliedUpdates ? validation!.currentPrice : (item.price || 0)) * (item.quantity || 1))}
                                  </span>
                                </div>
                              </div>

                              {/* Move to Wishlist */}
                              {!isOutOfStock && (
                                <button
                                  onClick={() => handleMoveToWishlist(item)}
                                  className="mt-2 text-xs text-gray-400 hover:text-red-600 transition-colors flex items-center gap-1"
                                >
                                  <Icon.PiHeart size={12} />
                                  Move to Wishlist
                                </button>
                              )}
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
                <div className="px-6 py-3 border-b border-gray-200">
                  <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-700 transition-colors">
                    <Icon.PiNotePencil size={16} />
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
                          className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none"
                          rows={2}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Summary */}
                <div className="p-5 space-y-2.5">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal ({cartCount} {cartCount === 1 ? 'item' : 'items'})</span>
                    <span className="font-semibold text-gray-900">{formatPrice(cartTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Shipping</span>
                    <span className="font-semibold">
                      {shipping === 0
                        ? <span className="text-red-700">Free</span>
                        : formatPrice(shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2.5 border-t border-gray-200">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-black text-gray-900">
                      {formatPrice(cartTotal + shipping)}
                    </span>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    <button
                      onClick={handleCheckout}
                      disabled={issueCount > 0 || validating}
                      className="w-full py-3.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl hover:from-red-800 hover:to-red-950 transition-all hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {validating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Checking cart…
                        </>
                      ) : issueCount > 0 ? (
                        <>
                          <Icon.PiWarning size={18} />
                          Resolve {issueCount} issue{issueCount > 1 ? 's' : ''} first
                        </>
                      ) : (
                        <>
                          <Icon.PiLockKey size={18} />
                          Proceed to Checkout
                        </>
                      )}
                    </button>
                    <Link
                      href="/cart"
                      onClick={closeModalCart}
                      className="w-full py-3 border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:border-red-700 hover:text-red-700 transition-all text-center block text-sm"
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
                  className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 max-w-sm w-full mx-4 z-[70] shadow-2xl"
                >
                  <div className="text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                      <Icon.PiWarning size={30} className="text-red-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Clear Cart?</h3>
                    <p className="text-gray-500 text-sm mb-6">
                      Remove all {cartCount} {cartCount === 1 ? 'item' : 'items'} from your cart?
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClearCart}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors text-sm"
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
