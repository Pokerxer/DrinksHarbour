'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useWishlist } from '@/context/WishlistContext';
import { useCart } from '@/context/CartContext';

export default function WishlistPage() {
  const router = useRouter();
  const { wishlistState, removeFromWishlist, clearWishlist, wishlistCount } = useWishlist();
  const { addToCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [addedToast, setAddedToast] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full" />
      </div>
    );
  }

  const items = wishlistState?.wishlistArray || [];

  const handleRemove = (productId: string, productName: string) => {
    removeFromWishlist(productId);
    setAddedToast(`${productName} removed from wishlist`);
    setTimeout(() => setAddedToast(null), 3000);
  };

  const handleAddToCart = async (item: any) => {
    setLoadingId(item._id || item.id);
    try {
      addToCart({
        ...item,
        quantity: 1,
        selectedSize: item.selectedSize || item.sizes?.[0]?.size || '',
        selectedSizeId: item.selectedSizeId || item.sizes?.[0]?._id || '',
        selectedSubProductId: item.selectedSubProductId || item._id || '',
        selectedProductId: item.selectedProductId || item._id || '',
        selectedVendor: item.selectedVendor || '',
        selectedVendorId: item.selectedVendorId || '',
        selectedColor: '',
        cartItemId: `${item._id || item.id}-${Date.now()}`,
      });
      
      removeFromWishlist(item._id || item.id);
      setAddedToast(`${item.name} added to cart!`);
      setTimeout(() => setAddedToast(null), 3000);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    } finally {
      setLoadingId(null);
    }
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    clearWishlist();
    setShowClearConfirm(false);
    setAddedToast('Wishlist cleared');
    setTimeout(() => setAddedToast(null), 3000);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 bg-white rounded-3xl shadow-lg"
          >
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="inline-flex"
            >
              <Icon.PiHeartBreakBold className="w-20 h-20 text-gray-300" />
            </motion.div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Your wishlist is empty</h2>
            <p className="mt-3 text-gray-500 max-w-sm mx-auto">
              Start adding items you love by clicking the heart icon on products
            </p>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link 
                href="/shop" 
                className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-all shadow-lg hover:shadow-xl"
              >
                Explore Products
                <Icon.PiArrowRightBold className="w-5 h-5" />
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8 md:py-12">
      <AnimatePresence>
        {addedToast && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-2"
          >
            <Icon.PiCheckCircleBold className="w-5 h-5 text-green-400" />
            {addedToast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 shadow-2xl z-50 max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                  <Icon.PiWarningBold className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-gray-900">Clear Wishlist?</h3>
                <p className="mt-2 text-gray-500">
                  This will remove all {items.length} item(s) from your wishlist. This action cannot be undone.
                </p>
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmClear}
                    className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">My Wishlist</h1>
            <p className="text-gray-500 mt-1">
              {items.length} item{items.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClearAll}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors flex items-center gap-2"
          >
            <Icon.PiTrashBold />
            <span className="hidden sm:inline">Clear All</span>
          </motion.button>
        </motion.div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          <AnimatePresence mode="popLayout">
            {items.map((item: any) => (
              <motion.div
                key={item._id || item.id}
                variants={itemVariants}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, x: 100 }}
                whileHover={{ y: -2 }}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow p-4 md:p-6 flex flex-col sm:flex-row gap-4 md:gap-6"
              >
                <motion.div 
                  className="w-full sm:w-28 md:w-32 h-28 md:h-32 relative flex-shrink-0 bg-gray-100 rounded-xl overflow-hidden cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                  onClick={() => router.push(`/product/${item.slug}`)}
                >
                  {item.thumbImage?.[0] || item.image || item.images?.[0] ? (
                    <Image 
                      src={item.thumbImage?.[0] || item.image || item.images?.[0]} 
                      alt={item.name} 
                      fill 
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon.PiImageBold className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  {item.onSale && (
                    <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                      SALE
                    </span>
                  )}
                </motion.div>
                
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex-1">
                    <Link 
                      href={`/product/${item.slug}`}
                      className="text-lg font-bold text-gray-900 hover:text-gray-700 line-clamp-2"
                    >
                      {item.name}
                    </Link>
                    
                    {item.category && (
                      <p className="text-sm text-gray-500 mt-1 capitalize">
                        {item.category.name || item.type}
                      </p>
                    )}
                    
                    {item.priceRange?.min !== undefined && (
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xl font-bold text-gray-900">
                          ₦{item.priceRange.min.toLocaleString()}
                        </span>
                        {item.priceRange.max > item.priceRange.min && (
                          <span className="text-gray-400 line-through text-sm">
                            ₦{item.priceRange.max.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}

                    {item.price && !item.priceRange && (
                      <p className="text-xl font-bold text-gray-900 mt-2">
                        ₦{Number(item.price).toLocaleString()}
                      </p>
                    )}

                    {item.availability?.status === 'out_of_stock' && (
                      <span className="inline-block mt-2 text-sm text-red-600 font-medium">
                        Out of Stock
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleAddToCart(item)}
                      disabled={loadingId === (item._id || item.id) || item.availability?.status === 'out_of_stock'}
                      className="px-5 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 text-white text-sm font-medium rounded-xl hover:from-gray-800 hover:to-gray-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {loadingId === (item._id || item.id) ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Icon.PiShoppingCartBold className="w-4 h-4" />
                          Add to Cart
                        </>
                      )}
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRemove(item._id || item.id, item.name)}
                      className="p-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-all"
                    >
                      <Icon.PiTrashBold className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10"
        >
          <Link 
            href="/shop" 
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            <Icon.PiArrowLeftBold />
            Continue Shopping
          </Link>
        </motion.div>
      </div>
    </div>
  );
}