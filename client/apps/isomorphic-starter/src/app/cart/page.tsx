'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useModalWishlistContext } from '@/context/ModalWishlistContext';

const Cart = () => {
  const router = useRouter();
  const { cartState, updateQuantity, removeFromCart, syncCartToServer, loadServerCart, clearCart } = useCart();
  const { addToWishlist } = useWishlist();
  const { openModalWishlist } = useModalWishlistContext();
  const [mounted, setMounted] = useState(false);
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [note, setNote] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number } | null>(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  useEffect(() => {
    const initCart = async () => {
      setMounted(true);
      await loadServerCart();
    };
    initCart();
  }, []);

  const subtotal = cartState.cartArray.reduce((sum, item) => {
    return sum + ((item.price || 0) * (item.quantity || 1));
  }, 0);

  const shipping = subtotal > 50000 ? 0 : 2500;
  const discount = appliedPromo ? (subtotal * appliedPromo.discount) / 100 : 0;
  const total = subtotal + shipping - discount;

  const handleQuantityChange = async (cartItemId: string, newQuantity: number) => {
    setUpdatingIds(prev => [...prev, cartItemId]);
    if (newQuantity <= 0) {
      await handleRemove(cartItemId);
    } else {
      updateQuantity(cartItemId, newQuantity);
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setUpdatingIds(prev => prev.filter(id => id !== cartItemId));
  };

  const handleRemove = async (cartItemId: string) => {
    setRemovingIds(prev => [...prev, cartItemId]);
    await new Promise(resolve => setTimeout(resolve, 300));
    removeFromCart(cartItemId);
    setRemovingIds(prev => prev.filter(id => id !== cartItemId));
  };

  const handleMoveToWishlist = async (item: any) => {
    const id = item.cartItemId;
    setRemovingIds(prev => [...prev, id]);
    await new Promise(resolve => setTimeout(resolve, 300));
    addToWishlist(item);
    removeFromCart(id);
    setRemovingIds(prev => prev.filter(i => i !== id));
    openModalWishlist();
  };

  const handleClearCart = async () => {
    const allIds = cartState.cartArray.map(item => item.cartItemId);
    setRemovingIds(allIds);
    await new Promise(resolve => setTimeout(resolve, 300));
    clearCart();
    setRemovingIds([]);
    setShowClearConfirm(false);
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setIsApplyingPromo(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    // Mock promo codes
    if (promoCode.toUpperCase() === 'SAVE10') {
      setAppliedPromo({ code: promoCode, discount: 10 });
    } else if (promoCode.toUpperCase() === 'SAVE20') {
      setAppliedPromo({ code: promoCode, discount: 20 });
    }
    setIsApplyingPromo(false);
    setPromoCode('');
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
  };

  const handleProceedToCheckout = async () => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (!token) {
      router.push('/login?redirect=/cart');
      return;
    }

    setIsSyncing(true);
    const timeoutId = setTimeout(() => {
      setIsSyncing(false);
      router.push('/checkout');
    }, 15000);

    const success = await syncCartToServer();
    clearTimeout(timeoutId);
    setIsSyncing(false);

    if (!success) {
      router.push('/login?redirect=/cart');
      return;
    }

    router.push('/checkout');
  };

  const formatPrice = (price: number) => {
    return '₦' + price.toLocaleString();
  };

  const getItemImage = (item: any) => {
    if (item.primaryImage?.url) return item.primaryImage.url;
    if (item.thumbImage?.[0]) return item.thumbImage[0];
    if (item.images?.[0]?.url) return item.images[0].url;
    return null;
  };

  const getShippingMessage = () => {
    if (shipping === 0) {
      return {
        title: 'You unlocked FREE shipping!',
        subtitle: 'Your order ships for free',
        icon: Icon.PiCheckCircle,
        color: 'green'
      };
    }
    const remaining = 50000 - subtotal;
    return {
      title: `Add ${formatPrice(remaining)} for FREE shipping`,
      subtitle: 'On orders over ₦50,000',
      icon: Icon.PiTruck,
      color: 'orange'
    };
  };

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-gray-200 border-t-green-500 rounded-full"
        />
      </div>
    );
  }

  const shippingInfo = getShippingMessage();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <motion.nav
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center text-sm text-gray-500 mb-6"
          >
            <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            <Icon.PiCaretRight size={16} className="mx-2" />
            <Link href="/shop" className="hover:text-gray-900 transition-colors">Shop</Link>
            <Icon.PiCaretRight size={16} className="mx-2" />
            <span className="text-gray-900 font-medium">Cart</span>
          </motion.nav>

          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <Icon.PiShoppingCart className="text-green-600" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
                <p className="text-gray-500">
                  {cartState.cartArray.length} {cartState.cartArray.length === 1 ? 'item' : 'items'} in your cart
                </p>
              </div>
            </div>

            {cartState.cartArray.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-2 px-6 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              >
                <Icon.PiTrash size={20} />
                Clear Cart
              </button>
            )}
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {cartState.cartArray.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto text-center py-16"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="w-32 h-32 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-8"
            >
              <Icon.PiShoppingCart size={64} className="text-gray-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Your cart is empty</h2>
            <p className="text-gray-600 mb-8">Looks like you haven't added any items to your cart yet.</p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 text-white font-semibold rounded-full hover:bg-green-700 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <Icon.PiShoppingBag size={20} />
              Start Shopping
            </Link>
          </motion.div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Cart Items */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="flex-1"
            >
              {/* Shipping Progress */}
              <div className={`bg-gradient-to-r from-${shippingInfo.color}-50 to-${shippingInfo.color === 'green' ? 'emerald' : 'orange'}-50 rounded-2xl p-5 border border-${shippingInfo.color}-100 mb-6`}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full bg-${shippingInfo.color}-100 flex items-center justify-center flex-shrink-0`}>
                    <shippingInfo.icon size={24} className={`text-${shippingInfo.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{shippingInfo.title}</p>
                    <p className="text-sm text-gray-500">{shippingInfo.subtitle}</p>
                  </div>
                </div>
                {shipping > 0 && (
                  <div className="mt-4">
                    <div className="h-2.5 bg-white rounded-full overflow-hidden shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: Math.min((subtotal / 50000) * 100, 100) + '%' }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {Math.min(Math.round((subtotal / 50000) * 100), 100)}% to free shipping
                    </p>
                  </div>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {cartState.cartArray.map((item, index) => {
                    const isRemoving = removingIds.includes(item.cartItemId);
                    const isUpdating = updatingIds.includes(item.cartItemId);

                    return (
                      <motion.div
                        key={item.cartItemId}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{
                          opacity: isRemoving ? 0 : 1,
                          y: isRemoving ? -20 : 0,
                          scale: isRemoving ? 0.9 : 1
                        }}
                        exit={{ opacity: 0, x: 100, scale: 0.9 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300"
                      >
                        <div className="flex p-4">
                          {/* Product Image */}
                          <Link href={`/product/${item.slug}`} className="relative w-28 h-28 flex-shrink-0">
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
                                  <Icon.PiImage size={40} className="text-gray-300" />
                                </div>
                              )}
                            </div>
                          </Link>

                          {/* Product Info */}
                          <div className="flex-1 ml-4 min-w-0">
                            <div className="flex justify-between items-start">
                              <Link href={`/product/${item.slug}`}>
                                <h3 className="font-semibold text-gray-900 text-base line-clamp-2 hover:text-green-600 transition-colors pr-8">
                                  {item.name}
                                </h3>
                              </Link>
                              <button
                                onClick={() => handleRemove(item.cartItemId)}
                                disabled={isRemoving}
                                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-red-100 hover:text-red-500 transition-all duration-200 flex-shrink-0"
                              >
                                <Icon.PiX size={16} />
                              </button>
                            </div>

                            {/* Tags */}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
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
                            <div className="flex items-center justify-between mt-4">
                              {/* Quantity Controls */}
                              <div className={`flex items-center border border-gray-200 rounded-lg overflow-hidden transition-opacity ${isUpdating ? 'opacity-50' : ''}`}>
                                <button
                                  onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) - 1)}
                                  disabled={(item.quantity || 1) <= 1 || isUpdating}
                                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Icon.PiMinusBold size={14} />
                                </button>
                                <span className="w-12 text-center font-semibold">
                                  {isUpdating ? (
                                    <motion.div
                                      animate={{ rotate: 360 }}
                                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                                      className="inline-block"
                                    >
                                      <Icon.PiSpinner size={16} />
                                    </motion.div>
                                  ) : (
                                    item.quantity || 1
                                  )}
                                </span>
                                <button
                                  onClick={() => handleQuantityChange(item.cartItemId, (item.quantity || 1) + 1)}
                                  disabled={(item.quantity || 1) >= 99 || isUpdating}
                                  className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                  <Icon.PiPlusBold size={14} />
                                </button>
                              </div>

                              {/* Price */}
                              <div className="text-right">
                                <p className="text-xl font-bold text-gray-900">
                                  {formatPrice((item.price || 0) * (item.quantity || 1))}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {formatPrice(item.price || 0)} each
                                </p>
                              </div>
                            </div>

                            {/* Move to Wishlist */}
                            <button
                              onClick={() => handleMoveToWishlist(item)}
                              className="mt-3 text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-1"
                            >
                              <Icon.PiHeart size={14} />
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-8"
              >
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all duration-300"
                >
                  <Icon.PiArrowLeft size={18} />
                  Continue Shopping
                </Link>
              </motion.div>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:w-[400px] flex-shrink-0"
            >
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sticky top-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Icon.PiReceipt size={24} className="text-green-600" />
                  Order Summary
                </h2>

                {/* Promo Code */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Promo Code
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value)}
                      placeholder="Enter code"
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-sm uppercase"
                      disabled={!!appliedPromo}
                    />
                    {appliedPromo ? (
                      <button
                        onClick={handleRemovePromo}
                        className="px-4 py-2.5 bg-red-100 text-red-600 font-medium rounded-lg hover:bg-red-200 transition-colors"
                      >
                        Remove
                      </button>
                    ) : (
                      <button
                        onClick={handleApplyPromo}
                        disabled={!promoCode.trim() || isApplyingPromo}
                        className="px-4 py-2.5 bg-gray-900 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isApplyingPromo ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          >
                            <Icon.PiSpinner size={16} />
                          </motion.div>
                        ) : (
                          'Apply'
                        )}
                      </button>
                    )}
                  </div>
                  {appliedPromo && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-green-600 mt-2 flex items-center gap-1"
                    >
                      <Icon.PiCheckCircle size={14} />
                      Code {appliedPromo.code} applied ({appliedPromo.discount}% off)
                    </motion.p>
                  )}
                </div>

                {/* Summary */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal ({cartState.cartArray.length} items)</span>
                    <span className="font-medium">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span className="flex items-center gap-2">
                      <Icon.PiTruck size={18} />
                      Shipping
                    </span>
                    <span className="font-medium">
                      {shipping === 0 ? (
                        <span className="text-green-600 flex items-center gap-1">
                          <Icon.PiCheckCircle size={16} />
                          Free
                        </span>
                      ) : (
                        formatPrice(shipping)
                      )}
                    </span>
                  </div>
                  {appliedPromo && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex justify-between text-green-600"
                    >
                      <span className="flex items-center gap-2">
                        <Icon.PiTag size={18} />
                        Discount ({appliedPromo.discount}%)
                      </span>
                      <span className="font-medium">-{formatPrice(discount)}</span>
                    </motion.div>
                  )}
                </div>

                <div className="border-t-2 border-gray-100 pt-4 mb-6">
                  <div className="flex justify-between items-end">
                    <span className="text-lg font-bold text-gray-900">Total</span>
                    <div className="text-right">
                      {appliedPromo && (
                        <p className="text-sm text-gray-400 line-through">{formatPrice(subtotal + shipping)}</p>
                      )}
                      <p className="text-3xl font-bold text-gray-900">{formatPrice(total)}</p>
                    </div>
                  </div>
                </div>

                {/* Checkout Button */}
                <button
                  onClick={handleProceedToCheckout}
                  disabled={isSyncing}
                  className="w-full py-4 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-all duration-300 hover:shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSyncing ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      >
                        <Icon.PiSpinner size={20} />
                      </motion.div>
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Icon.PiLockKey size={20} />
                      Proceed to Checkout
                    </>
                  )}
                </button>

                {/* Trust Badges */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Icon.PiShieldCheck size={20} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">Secure Payment</p>
                      <p className="text-xs text-gray-500">SSL Encrypted</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Icon.PiArrowUUpLeft size={20} className="text-orange-600" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-900">Easy Returns</p>
                      <p className="text-xs text-gray-500">30 Day Policy</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 max-w-md w-full mx-4 z-[60] shadow-2xl"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Icon.PiWarning size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Clear Cart?</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to remove all items from your cart?
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

export default Cart;
