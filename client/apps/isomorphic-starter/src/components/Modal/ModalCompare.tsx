"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import * as Icon from "react-icons/pi";
import { useModalCompareContext } from "@/context/ModalCompareContext";
import { useCompare } from "@/context/CompareContext";
import { ProductType } from "@/type/ProductType";

const ModalCompare = () => {
  const { isModalOpen, closeModalCompare } = useModalCompareContext();
  const { compareState, removeFromCompare, clearCompare, compareCount } = useCompare();
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  const handleRemove = (productId: string) => {
    setRemovingId(productId);
    setTimeout(() => {
      removeFromCompare(productId);
      setRemovingId(null);
    }, 300);
  };

  const handleClearAll = () => {
    clearCompare();
  };

  const formatPrice = (price: number | undefined | null, currencySymbol: string = "₦") => {
    if (price == null || isNaN(price)) return `${currencySymbol}0`;
    return `${currencySymbol}${price.toLocaleString()}`;
  };

  // Get product badge (sale, new, featured)
  const getProductBadge = (product: ProductType) => {
    if (product.sale && product.originPrice && product.originPrice > product.price) {
      return { text: "Sale", className: "bg-red-500" };
    }
    if (product.badge) {
      return { text: product.badge.text, className: `bg-${product.badge.color}-500` };
    }
    return null;
  };

  // Animation variants for content only
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 25
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: { duration: 0.2 }
    }
  };

  const emptyStateVariants = {
    hidden: { opacity: 0, scale: 0.9 },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 20
      }
    }
  };

  return (
    <>
      {/* Backdrop - CSS animated */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-md z-[100] transition-opacity duration-300 ${
          isModalOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={closeModalCompare}
        aria-hidden={!isModalOpen}
      />

      {/* Modal Content - Uses CSS classes from modal.scss */}
      <div className="modal-compare-block" onClick={closeModalCompare}>
        <div
          className={`modal-compare-main py-6 ${isModalOpen ? "open" : ""}`}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Product comparison modal"
        >
          {/* Close Button */}
          <motion.button
            className="close-btn absolute 2xl:right-6 right-4 2xl:top-6 md:-top-4 top-3 lg:w-10 w-6 lg:h-10 h-6 rounded-full bg-white flex items-center justify-center duration-300 cursor-pointer hover:bg-gray-900 hover:text-white transition-all shadow-lg z-10"
            onClick={closeModalCompare}
            aria-label="Close comparison modal"
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            <Icon.PiX size={18} />
          </motion.button>

          <div className="container h-full flex items-center w-full">
            <div className="content-main flex items-center justify-between xl:gap-10 gap-6 w-full max-md:flex-wrap">
              {/* Header */}
              <motion.div 
                className="heading5 flex-shrink-0 max-md:w-full flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={isModalOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{ delay: 0.2, duration: 0.3 }}
              >
                <motion.div
                  className="w-12 h-12 rounded-2xl bg-gray-900 flex items-center justify-center"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Icon.PiScales size={24} className="text-white" />
                </motion.div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Compare</h3>
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    Products
                    {compareCount > 0 && (
                      <motion.span 
                        key={compareCount}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="bg-gray-900 text-white text-xs px-2 py-0.5 rounded-full"
                      >
                        {compareCount}
                      </motion.span>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Product List */}
              <div className="list-product flex items-center w-full gap-4 overflow-x-auto pb-2">
                {compareState.compareArray.length === 0 ? (
                  /* Empty State */
                  <motion.div
                    className="flex flex-col items-center justify-center w-full py-8 text-center"
                    variants={emptyStateVariants}
                    initial="hidden"
                    animate={isModalOpen ? "visible" : "hidden"}
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                    >
                      <Icon.PiScales size={48} className="text-gray-300 mb-3" />
                    </motion.div>
                    <motion.h4
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-lg font-semibold text-gray-700 mb-2"
                    >
                      No products to compare
                    </motion.h4>
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="text-gray-400 text-sm mb-4"
                    >
                      Add products to start comparing features
                    </motion.p>
                    <motion.button
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      onClick={closeModalCompare}
                      className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      Continue Shopping
                    </motion.button>
                  </motion.div>
                ) : (
                  /* Product Items */
                  <motion.div 
                    className="flex items-center gap-4"
                    variants={containerVariants}
                    initial="hidden"
                    animate={isModalOpen ? "visible" : "hidden"}
                  >
                    {compareState.compareArray.slice(0, 4).map((product, index) => {
                      const badge = getProductBadge(product);
                      const isRemoving = removingId === product.id;
                      
                      return (
                        <motion.div
                          key={product.id}
                          className={`item p-3 border border-line rounded-xl relative min-w-[200px] transition-all duration-200 ${
                            isRemoving ? "opacity-0 scale-95" : "opacity-100 scale-100"
                          }`}
                          variants={itemVariants}
                          layout
                          whileHover={{ 
                            y: -4, 
                            boxShadow: "0 12px 40px rgba(0,0,0,0.1)"
                          }}
                        >
                          {/* Badge */}
                          <AnimatePresence>
                            {badge && (
                              <motion.div
                                key={`badge-${product.id}`}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                className={`absolute -top-2 -left-2 px-2 py-1 ${badge.className} text-white text-xs font-semibold rounded-lg shadow-md`}
                              >
                                {badge.text}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="infor flex items-center gap-4">
                            <div className="bg-img w-[80px] h-[80px] flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                              {product.images && product.images.length > 0 && typeof product.images[0] === 'string' && product.images[0] ? (
                                <Image
                                  src={product.images[0]}
                                  width={300}
                                  height={300}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-200 text-gray-400">
                                  <Icon.PiImage size={24} />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="name text-title text-sm font-medium line-clamp-2">
                                {product.name}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="product-price text-title font-bold text-gray-900">
                                  {formatPrice(product.price)}
                                </div>
                                {product.originPrice && product.originPrice > product.price && (
                                  <div className="product-origin-price text-xs text-gray-400 line-through">
                                    {formatPrice(product.originPrice)}
                                  </div>
                                )}
                              </div>
                              {/* Rating */}
                              {product.rating && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Icon.PiStarFill size={12} className="text-yellow-400" />
                                  <span className="text-xs text-gray-600">
                                    {product.rating} ({product.reviewCount || 0})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Remove Button */}
                          <motion.button
                            className="close-btn absolute -right-2 -top-2 w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                            onClick={() => handleRemove(product.id)}
                            aria-label={`Remove ${product.name} from comparison`}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Icon.PiX size={14} />
                          </motion.button>
                        </motion.div>
                      );
                    })}

                    {/* Show message if more than 4 products */}
                    {compareState.compareArray.length > 4 && (
                      <div className="flex-shrink-0 px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600">
                        +{compareState.compareArray.length - 4} more
                      </div>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Action Buttons */}
              {compareState.compareArray.length > 0 && (
                <div className="block-button flex flex-col gap-3 flex-shrink-0">
                  {compareState.compareArray.length < 2 ? (
                    <button
                      className="button-main whitespace-nowrap opacity-50 cursor-not-allowed"
                      disabled
                      aria-label="Minimum 2 products required"
                    >
                      Compare Products
                    </button>
                  ) : (
                    <Link
                      href={"/compare"}
                      onClick={closeModalCompare}
                      className="button-main whitespace-nowrap flex items-center justify-center gap-2"
                    >
                      <span>Compare Products</span>
                      <Icon.PiArrowRight size={16} />
                    </Link>
                  )}

                  <button
                    onClick={handleClearAll}
                    className="button-main whitespace-nowrap border-2 border-gray-900 bg-white text-gray-900 hover:bg-gray-50 transition-colors"
                    aria-label="Clear all comparison products"
                  >
                    Clear All Products
                  </button>

                  <button
                    onClick={closeModalCompare}
                    className="text-sm text-gray-500 hover:text-gray-900 text-center transition-colors underline-offset-2 hover:underline"
                  >
                    Continue Shopping
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModalCompare;
