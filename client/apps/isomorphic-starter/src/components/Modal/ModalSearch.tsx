'use client';

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalSearchContext } from '@/context/ModalSearchContext';
import { useCart } from '@/context/CartContext';
import { useModalCartContext } from '@/context/ModalCartContext';
import { useModalQuickviewContext } from '@/context/ModalQuickviewContext';
import { ProductType } from '@/types/product.types';

type Product = ProductType & {
  vendorName?: string;
};

interface SearchResult {
  products: Product[];
  total: number;
  page: number;
  totalPages: number;
}

const ModalSearch: React.FC = () => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [highlightedText, setHighlightedText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [showFullDetails, setShowFullDetails] = useState<string | null>(null);

  const { addToCart } = useCart();
  const { openModalCart } = useModalCartContext();
  const { openQuickview } = useModalQuickviewContext() || {};

  const {
    isModalOpen,
    closeModalSearch,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    searchError,
    recentSearches,
    removeRecentSearch,
    clearRecentSearches,
    popularSearches,
    performSearch,
  } = useModalSearchContext();

  const categories = useMemo(() => [
    { name: 'Spirits', icon: '🥃', href: '/shop?type=spirit', count: 45 },
    { name: 'Wine', icon: '🍷', href: '/shop?type=wine', count: 128 },
    { name: 'Beer', icon: '🍺', href: '/shop?type=beer', count: 67 },
    { name: 'Champagne', icon: '🍾', href: '/shop?type=champagne', count: 23 },
    { name: 'Vodka', icon: '❄️', href: '/shop?type=vodka', count: 34 },
    { name: 'Whiskey', icon: '🥃', href: '/shop?type=whiskey', count: 56 },
    { name: 'Gin', icon: '🍸', href: '/shop?type=gin', count: 29 },
    { name: 'Rum', icon: '🏝️', href: '/shop?type=rum', count: 41 },
  ], []);

  const quickActions = useMemo(() => [
    { label: 'On Sale', icon: Icon.PiTag, href: '/shop?onSale=true', color: 'text-red-500' },
    { label: 'New Arrivals', icon: Icon.PiSparkle, href: '/shop?sort=newest', color: 'text-emerald-500' },
    { label: 'Bestsellers', icon: Icon.PiTrendUp, href: '/shop?sort=popular', color: 'text-orange-500' },
    { label: 'Top Rated', icon: Icon.PiStar, href: '/shop?minRating=4', color: 'text-yellow-500' },
  ], []);

  const searchFilters = useMemo(() => [
    { id: 'inStock', label: 'In Stock', icon: Icon.PiCheckCircle },
    { id: 'onSale', label: 'On Sale', icon: Icon.PiTag },
    { id: 'newArrival', label: 'New', icon: Icon.PiSparkle },
  ], []);

  // Handle clear search - reset everything
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setHighlightedText('');
    setShowFullDetails(null);
    setSelectedIndex(-1);
    setShowFilters(false);
    setActiveFilter(null);
  }, [setSearchQuery]);

  // Handle voice search
  const startVoiceSearch = useCallback(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
        performSearch(transcript);
      };
      
      recognition.start();
    }
  }, [performSearch, setSearchQuery]);

  // Handle filter toggle
  const handleFilterToggle = useCallback((filterId: string) => {
    setActiveFilter(prev => prev === filterId ? null : filterId);
    setShowFilters(false);
  }, []);

  // Quick add to cart from search - opens quickview instead
  const handleQuickAdd = useCallback((product: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    closeModalSearch();
    if (openQuickview) {
      openQuickview(product);
    }
  }, [openQuickview, closeModalSearch]);

  // Format timestamp
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // Handle real-time search with debounce
  useEffect(() => {
    const query = searchQuery.trim();
    
    if (query.length >= 1) {
      const debounceTimer = setTimeout(() => {
        performSearch(query);
        setHighlightedText(query);
      }, 150);
      return () => clearTimeout(debounceTimer);
    } else {
      setHighlightedText('');
      setShowFullDetails(null);
    }
  }, [searchQuery, performSearch]);

  // Focus input when modal opens and reset state
  useEffect(() => {
    if (isModalOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSelectedIndex(-1);
      setShowFilters(false);
      // Reset search results if no query
      if (!searchQuery.trim()) {
        setHighlightedText('');
        setShowFullDetails(null);
      }
    }
  }, [isModalOpen, searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;

      const results = searchResults?.products || [];
      const totalItems = results.length;

      switch (e.key) {
        case 'Escape':
          closeModalSearch();
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (totalItems > 0) {
            setSelectedIndex((prev) => (prev + 1) % totalItems);
            scrollToSelected();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (totalItems > 0) {
            setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
            scrollToSelected();
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && results[selectedIndex]) {
            handleResultClick(results[selectedIndex]);
          } else if (searchQuery.trim()) {
            performSearch();
          }
          break;
        case 'Tab':
          if (e.shiftKey) {
            e.preventDefault();
            if (totalItems > 0) {
              setSelectedIndex((prev) => (prev - 1 + totalItems) % totalItems);
            }
          } else {
            e.preventDefault();
            if (totalItems > 0) {
              setSelectedIndex((prev) => (prev + 1) % totalItems);
            }
          }
          scrollToSelected();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, searchResults, selectedIndex, searchQuery, closeModalSearch, performSearch]);

  // Scroll selected item into view
  const scrollToSelected = () => {
    setTimeout(() => {
      const selectedElement = resultsRef.current?.querySelector('[data-selected="true"]');
      selectedElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const handleSearch = useCallback((value: string) => {
    if (value.trim()) {
      performSearch(value.trim());
      setSelectedIndex(-1);
    }
  }, [performSearch]);

  const handleResultClick = useCallback((product: Product) => {
    const slug = product.slug || product._id || product.id;
    if (slug) {
      router.push(`/product/${slug}`);
      closeModalSearch();
    }
  }, [router, closeModalSearch]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      closeModalSearch();
    }
  };

  const getProductImage = (product: Product): string => {
    if (product.primaryImage?.url) return product.primaryImage.url;
    if (product.thumbImage && product.thumbImage.length > 0) {
      const img = product.thumbImage[0] as string | { url: string };
      if (typeof img === 'string') return img;
      if (img && 'url' in img) return img.url;
      return '/images/placeholder-product.png';
    }
    if (product.images && product.images.length > 0) {
      const img = product.images[0] as string | { url: string };
      if (typeof img === 'string') return img;
      if (img && 'url' in img) return img.url;
      return '/images/placeholder-product.png';
    }
    return '/images/placeholder-product.png';
  };

  const formatPrice = (price: number, currency: string = 'NGN'): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const getProductPrice = (product: Product): { price: number; originalPrice?: number; hasDiscount: boolean } => {
    if (product.priceRange) {
      const hasDiscount = product.priceRange.max > product.priceRange.min;
      return {
        price: product.priceRange.min || 0,
        originalPrice: hasDiscount ? product.priceRange.max : undefined,
        hasDiscount,
      };
    }
    return {
      price: 0,
      hasDiscount: false,
    };
  };

  // Highlight search term in text
  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <span key={i} className="bg-yellow-200 font-semibold">{part}</span>
      ) : (
        part
      )
    );
  };

  const escapeRegex = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  if (!isModalOpen) return null;

  const hasResults = searchResults && searchResults.products.length > 0;
  const hasError = !!searchError;
  const isSearchingWithQuery = isSearching && searchQuery.length > 0;
  const totalResults = searchResults?.total || 0;
  const totalInStock = searchResults?.products.filter(p => p.availability?.status !== 'out_of_stock').length || 0;

  return (
    <motion.div
      ref={modalRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-12 md:pt-16 px-2 md:px-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="relative w-full max-w-2xl bg-white rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] md:max-h-[80vh] flex flex-col"
      >
        {/* Search Input */}
        <div className="p-4 md:p-5 border-b border-gray-100">
          <div className="relative">
            <Icon.PiMagnifyingGlass
              className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-gray-400"
              size={20}
            />
            
            <input
              ref={inputRef}
              type="text"
              placeholder="Search products, brands, categories..."
              className="w-full h-12 md:h-14 pl-10 md:pl-12 pr-10 md:pr-16 bg-gray-50 border-2 border-transparent focus:border-green-500 rounded-xl md:rounded-2xl text-base md:text-lg outline-none transition-all placeholder:text-gray-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
              aria-autocomplete="list"
              aria-controls="search-results"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {/* Voice Search Button */}
              {typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) && (
                <button
                  onClick={startVoiceSearch}
                  className={`p-1.5 rounded-lg transition-colors ${isListening ? 'bg-red-100 text-red-500 animate-pulse' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
                  aria-label="Voice search"
                >
                  {isListening ? <Icon.PiMicrophoneFill size={16} /> : <Icon.PiMicrophone size={16} />}
                </button>
              )}
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-gray-200 border-t-green-500 rounded-full animate-spin" />
              ) : searchQuery ? (
                <button
                  onClick={handleClearSearch}
                  className="p-1 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
                  aria-label="Clear search"
                >
                  <Icon.PiX size={14} className="text-gray-600" />
                </button>
              ) : null}
            </div>
            </div>

          {/* Search Stats - Show total quantity prominently */}
          {hasResults && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {/* Filter Pills */}
              <div className="relative">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    showFilters || activeFilter 
                      ? 'bg-green-100 text-green-700 border border-green-300' 
                      : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                  }`}
                >
                  <Icon.PiFunnel size={14} />
                  Filter
                </button>
                
                {/* Filter Dropdown */}
                {showFilters && (
                  <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-10 min-w-[140px]">
                    {searchFilters.map(filter => (
                      <button
                        key={filter.id}
                        onClick={() => handleFilterToggle(filter.id)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                          activeFilter === filter.id ? 'text-green-600 bg-green-50' : 'text-gray-700'
                        }`}
                      >
                        <filter.icon size={16} />
                        {filter.label}
                        {activeFilter === filter.id && <Icon.PiCheck size={14} className="ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full">
                <Icon.PiPackage size={16} className="text-green-600" />
                <span className="font-semibold text-green-700">
                  {totalResults} {totalResults === 1 ? 'product' : 'products'} found
                </span>
              </div>
              {totalInStock > 0 && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>{totalInStock} available</span>
                </div>
              )}
              {searchResults.totalPages > 1 && (
                <span className="text-gray-400 text-xs">
                  Page {searchResults.page} of {searchResults.totalPages}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div 
          ref={resultsRef}
          className="flex-1 overflow-y-auto"
          id="search-results"
          role="listbox"
        >
          <AnimatePresence mode="wait">
            {/* Search Results */}
            {hasResults ? (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 md:p-5"
              >
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide">
                    Products
                  </h3>
                  <button
                    onClick={() => {
                      // Build URL with search query and filters
                      let url = `/shop?search=${encodeURIComponent(searchQuery)}`;
                      if (activeFilter === 'inStock') url += '&inStock=true';
                      if (activeFilter === 'onSale') url += '&onSale=true';
                      if (activeFilter === 'newArrival') url += '&sort=newest';
                      router.push(url);
                      closeModalSearch();
                    }}
                    className="flex items-center gap-1 text-xs md:text-sm text-green-600 font-medium hover:text-green-700 transition-colors"
                  >
                    <span>View all</span>
                    <Icon.PiArrowRight size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                  {searchResults.products.map((product, index) => {
                    const { price, originalPrice, hasDiscount } = getProductPrice(product);
                    const isSelected = index === selectedIndex;
                    const inStock = product.availability?.status !== 'out_of_stock';
                    const stockCount = product.availability?.totalStock || 0;
                    const isExpanded = showFullDetails === (product.id || product._id);
                    
                    return (
                      <motion.div
                        key={product.id || product._id}
                        data-selected={isSelected}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => {
                          if (isExpanded) {
                            handleResultClick(product);
                          } else {
                            setShowFullDetails(product.id || product._id || null);
                          }
                        }}
                        className={`flex gap-2 md:gap-3 p-2 md:p-3 rounded-xl cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-green-50 border-2 border-green-500' 
                            : 'hover:bg-gray-50 border-2 border-transparent'
                        }`}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={0}
                      >
                        {/* Product Image */}
                        <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          <Image
                            src={getProductImage(product)}
                            alt={product.name}
                            fill
                            className="object-cover"
                            sizes="80px"
                          />
                          {hasDiscount && (
                            <span className="absolute top-0.5 left-0.5 px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded">
                              SALE
                            </span>
                          )}
                          {!inStock && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="text-white text-xs font-bold">Out of Stock</span>
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm md:text-base text-gray-900 truncate">
                            {highlightMatch(product.name, highlightedText)}
                          </h4>
                          
                          {product.category && (
                            <p className="text-xs text-gray-500 mt-0.5 hidden md:block">
                              {product.category.name}
                              {product.brand && ` • ${product.brand.name}`}
                            </p>
                          )}

                          {/* Rating */}
                          {(product.stats?.averageRating || product.rate) && (product.stats?.averageRating || product.rate)! > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Icon.PiStar size={12} className="text-yellow-400 fill-yellow-400" />
                              <span className="text-xs text-gray-600">
                                {(product.stats?.averageRating || product.rate || 0).toFixed(1)}
                              </span>
                            </div>
                          )}

                          {/* Price & Stock Row */}
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-green-600 text-sm md:text-base">
                                {formatPrice(price)}
                              </span>
                              {hasDiscount && originalPrice && (
                                <span className="text-xs text-gray-400 line-through hidden md:inline">
                                  {formatPrice(originalPrice)}
                                </span>
                              )}
                            </div>
                            
                            {/* Stock Badge */}
                            {inStock && stockCount > 0 && (
                              <span className={`text-[10px] md:text-xs px-1.5 py-0.5 rounded-full ${
                                stockCount > 10 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {stockCount} left
                              </span>
                            )}
                          </div>

                          {/* Expanded: Quick Add Button */}
                          {isExpanded && inStock && (
                            <motion.button
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              onClick={(e) => handleQuickAdd(product, e)}
                              className="mt-2 w-full py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                            >
                              <Icon.PiShoppingCart size={16} />
                              Quick Add to Cart
                            </motion.button>
                          )}
                        </div>

                        {/* Arrow indicator for selected item */}
                        {isSelected && (
                          <div className="flex items-center">
                            <Icon.PiArrowRight size={18} className="text-green-600" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Keyboard Navigation Help */}
                <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">↑</kbd>
                    <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">↓</kbd>
                    to navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Enter</kbd>
                    to select
                  </span>
                </div>
              </motion.div>
            ) : hasError ? (
              /* Error State */
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8 md:p-10 text-center"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                  <Icon.PiWarning size={28} className="text-red-400" />
                </div>
                <p className="text-gray-600 font-medium text-sm md:text-base">{searchError}</p>
                <button
                  onClick={() => performSearch()}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                >
                  Try Again
                </button>
              </motion.div>
            ) : isSearchingWithQuery ? (
              /* Loading State with Skeletons */
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-4 md:p-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex gap-2 md:gap-3 p-2 md:p-3 rounded-xl">
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg md:rounded-xl bg-gray-200 animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 md:h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                        <div className="h-2 md:h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
                        <div className="h-3 md:h-4 bg-gray-200 rounded w-1/4 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : searchQuery.length > 0 ? (
              /* No Results with Suggestions */
              <motion.div
                key="no-results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-8 md:p-10 text-center"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Icon.PiMagnifyingGlass size={36} className="text-gray-300" />
                </div>
                <p className="text-gray-600 font-medium text-sm md:text-lg">
                  No products found for &quot;{searchQuery}&quot;
                </p>
                <p className="text-xs md:text-sm text-gray-400 mt-2 mb-5 md:mb-6">
                  Try adjusting your search or browse categories below
                </p>
                
                {/* Alternative Suggestions */}
                <div className="space-y-4">
                  <div>
                    <p className="text-xs md:text-sm font-medium text-gray-600 mb-2 md:mb-3">Try searching for:</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['Red Wine', 'Whiskey', 'Beer', 'Vodka', 'Champagne'].map((term) => (
                        <button
                          key={term}
                          onClick={() => {
                            setSearchQuery(term);
                            performSearch(term);
                          }}
                          className="px-3 py-1.5 md:py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-xs md:text-sm text-gray-700 transition-colors"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Default State - Categories, Recent Searches, Popular, Quick Actions */
              <motion.div
                key="default"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 md:p-5"
              >
                {/* Quick Actions */}
                <div className="mb-5">
                  <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Quick Actions
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        onClick={() => {
                          router.push(action.href);
                          closeModalSearch();
                        }}
                        className="flex items-center gap-2 p-2 md:p-3 rounded-xl hover:bg-gray-50 transition-colors border border-gray-100 hover:border-gray-200"
                      >
                        <action.icon size={18} className={action.color} />
                        <span className="text-xs md:text-sm font-medium text-gray-700">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide">
                        Recent Searches
                      </h3>
                      <button
                        onClick={clearRecentSearches}
                        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recentSearches.slice(0, 6).map((search) => (
                        <button
                          key={search.query}
                          onClick={() => {
                            setSearchQuery(search.query);
                            performSearch(search.query);
                          }}
                          className="group flex items-center gap-1.5 px-3 py-1.5 md:py-2 bg-gray-100 hover:bg-gray-200 rounded-full text-xs md:text-sm text-gray-700 transition-colors"
                        >
                          <Icon.PiClock size={12} className="text-gray-400" />
                          <span className="max-w-[100px] md:max-w-[120px] truncate">{search.query}</span>
                          <span className="text-[10px] text-gray-400 hidden md:inline">{formatTimeAgo(search.timestamp)}</span>
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecentSearch(search.query);
                            }}
                            className="ml-1 p-0.5 rounded-full hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Icon.PiX size={10} className="text-gray-500" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                <div className="mb-5">
                  <h3 className="text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Browse Categories
                  </h3>
                  <div className="grid grid-cols-4 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.name}
                        onClick={() => {
                          router.push(cat.href);
                          closeModalSearch();
                        }}
                        className="flex flex-col items-center gap-1 md:gap-2 p-2 md:p-3 rounded-xl hover:bg-green-50 transition-colors group"
                      >
                        <span className="text-xl md:text-2xl">{cat.icon}</span>
                        <span className="text-[10px] md:text-xs font-medium text-gray-600 group-hover:text-green-700 text-center">
                          {cat.name}
                        </span>
                        <span className="text-[9px] md:text-xs text-gray-400 hidden md:block">{cat.count}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Popular Searches */}
                <div>
                  <h3 className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    <Icon.PiFire className="text-orange-500" size={14} />
                    Popular Searches
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setSearchQuery(term);
                          performSearch(term);
                        }}
                        className="px-3 py-1.5 md:py-2 bg-gray-100 hover:bg-orange-50 rounded-full text-xs md:text-sm font-medium text-gray-700 hover:text-orange-700 transition-colors"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 md:py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-3 md:gap-4">
            <button
              onClick={closeModalSearch}
              className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Icon.PiXBold size={14} />
              <span className="hidden md:inline">Close</span>
            </button>
          </div>
          <div className="hidden md:flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">Enter</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded text-xs font-mono">ESC</kbd>
              close
            </span>
          </div>
          {/* Mobile shortcuts */}
          <div className="flex md:hidden items-center gap-2 text-xs text-gray-400">
            <kbd className="px-1 py-0.5 bg-gray-200 rounded">↑↓</kbd>
            <kbd className="px-1 py-0.5 bg-gray-200 rounded">↵</kbd>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ModalSearch;
