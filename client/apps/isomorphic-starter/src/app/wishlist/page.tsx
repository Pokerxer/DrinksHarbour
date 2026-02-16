'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import Product from '@/components/Product/Card';

const Wishlist = () => {
  const { wishlistState, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [layoutCol, setLayoutCol] = useState<number>(4);
  const [removingIds, setRemovingIds] = useState<string[]>([]);
  const [addingToCartIds, setAddingToCartIds] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLayoutCol = (col: number) => {
    setLayoutCol(col);
  };

  const handleRemove = async (productId: string) => {
    setRemovingIds(prev => [...prev, productId]);
    await new Promise(resolve => setTimeout(resolve, 300));
    removeFromWishlist(productId);
    setRemovingIds(prev => prev.filter(id => id !== productId));
  };

  const handleAddToCart = async (product: any) => {
    setAddingToCartIds(prev => [...prev, product.id]);
    addToCart(product);
    await new Promise(resolve => setTimeout(resolve, 500));
    setAddingToCartIds(prev => prev.filter(id => id !== product.id));
  };

  const handleAddAllToCart = async () => {
    for (const product of wishlistState.wishlistArray) {
      await handleAddToCart(product);
    }
    openModalCart();
  };

  const handleClearWishlist = async () => {
    // Animate all items out
    const allIds = wishlistState.wishlistArray.map(p => p.id);
    setRemovingIds(allIds);
    await new Promise(resolve => setTimeout(resolve, 300));
    clearWishlist();
    setRemovingIds([]);
    setShowClearConfirm(false);
  };

  const getTotalSavings = () => {
    return wishlistState.wishlistArray.reduce((total, product) => {
      if (product.originPrice && product.originPrice > product.price) {
        return total + (product.originPrice - product.price);
      }
      return total;
    }, 0);
  };

  const getGridClass = () => {
    switch (layoutCol) {
      case 2:
        return 'grid-cols-1';
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      case 4:
      default:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"
        />
      </div>
    );
  }

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
            <span className="text-gray-900 font-medium">My Wishlist</span>
          </motion.nav>

          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <Icon.PiHeartFill className="text-red-500" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">My Wishlist</h1>
                <p className="text-gray-500">
                  {wishlistState.wishlistArray.length} {wishlistState.wishlistArray.length === 1 ? 'item' : 'items'} saved
                </p>
              </div>
            </div>

            {wishlistState.wishlistArray.length > 0 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleAddAllToCart}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-all duration-300 hover:shadow-lg"
                >
                  <Icon.PiShoppingCart size={20} />
                  Add All to Cart
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {wishlistState.wishlistArray.length === 0 ? (
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
              <Icon.PiHeart size={64} className="text-gray-400" />
            </motion.div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Your wishlist is empty</h2>
            <p className="text-gray-600 mb-8">Save your favorite items to purchase later and never miss out on great deals.</p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white font-semibold rounded-full hover:bg-gray-800 transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
            >
              <Icon.PiShoppingBag size={20} />
              Start Shopping
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Toolbar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="text-gray-600">
                    Showing <span className="font-semibold text-gray-900">{wishlistState.wishlistArray.length}</span> products
                  </span>
                  
                  {getTotalSavings() > 0 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-green-600 text-sm font-medium bg-green-50 px-3 py-1 rounded-full">
                      <Icon.PiTag size={14} />
                      Save ${getTotalSavings().toFixed(2)} total
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Layout Toggle */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                    <button
                      onClick={() => handleLayoutCol(4)}
                      className={`p-2 rounded-md transition-all duration-200 ${
                        layoutCol === 4 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title="4 columns"
                    >
                      <Icon.PiSquaresFour size={20} />
                    </button>
                    <button
                      onClick={() => handleLayoutCol(3)}
                      className={`p-2 rounded-md transition-all duration-200 ${
                        layoutCol === 3 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title="3 columns"
                    >
                      <Icon.PiGridFour size={20} />
                    </button>
                    <button
                      onClick={() => handleLayoutCol(2)}
                      className={`p-2 rounded-md transition-all duration-200 ${
                        layoutCol === 2 ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                      }`}
                      title="List view"
                    >
                      <Icon.PiList size={20} />
                    </button>
                  </div>

                  {/* Clear Button */}
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
                  >
                    <Icon.PiTrash size={18} />
                    <span className="hidden sm:inline">Clear All</span>
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Products Grid */}
            <motion.div
              layout
              className={`grid gap-6 ${getGridClass()}`}
            >
              <AnimatePresence mode="popLayout">
                {wishlistState.wishlistArray.map((product, index) => {
                  const isRemoving = removingIds.includes(product.id);
                  const isAddingToCart = addingToCartIds.includes(product.id);

                  return (
                    <motion.div
                      key={product.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: isRemoving ? 0 : 1, 
                        y: isRemoving ? -20 : 0,
                        scale: isRemoving ? 0.9 : 1
                      }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      className="relative group"
                    >
                      <Product data={product} type="grid" />
                      
                      {/* Action Buttons Overlay */}
                      <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <button
                          onClick={() => handleAddToCart(product)}
                          disabled={isAddingToCart}
                          className={`w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 ${
                            isAddingToCart
                              ? 'bg-gray-100 text-gray-400'
                              : 'bg-gray-900 text-white hover:bg-gray-800'
                          }`}
                          title="Add to cart"
                        >
                          {isAddingToCart ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                            >
                              <Icon.PiSpinner size={18} />
                            </motion.div>
                          ) : (
                            <Icon.PiShoppingCart size={18} />
                          )}
                        </button>

                        <button
                          onClick={() => handleRemove(product.id)}
                          disabled={isRemoving}
                          className="w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200 hover:scale-110"
                          title="Remove from wishlist"
                        >
                          <Icon.PiX size={18} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>

            {/* Bottom Actions */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white border-2 border-gray-900 text-gray-900 font-semibold rounded-full hover:bg-gray-900 hover:text-white transition-all duration-300"
              >
                <Icon.PiArrowLeft size={20} />
                Continue Shopping
              </Link>
            </motion.div>
          </>
        )}
      </div>

      {/* Clear Confirmation Modal */}
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
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-8 max-w-md w-full mx-4 z-50 shadow-2xl"
            >
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <Icon.PiWarning size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Clear Wishlist?</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to remove all {wishlistState.wishlistArray.length} items from your wishlist?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearWishlist}
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

export default Wishlist;
