// @ts-nocheck
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Badge, Flex, Input } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiMagnifyingGlassBold,
  PiXBold,
  PiClockBold,
  PiTrendUpBold,
  PiPackageBold,
  PiTagBold,
  PiArrowRightBold,
  PiKeyboardBold,
  PiSpinnerGapBold,
} from 'react-icons/pi';

interface SearchSuggestion {
  type: 'recent' | 'product' | 'sku' | 'category';
  text: string;
  subtitle?: string;
  icon?: React.ElementType;
}

interface EnhancedSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
  isSearching?: boolean;
  recentSearches?: string[];
  suggestions?: SearchSuggestion[];
  placeholder?: string;
}

const SEARCH_TIPS = [
  { key: 'Enter', action: 'Search' },
  { key: 'Esc', action: 'Clear' },
  { key: '/', action: 'Focus' },
];

const QUICK_FILTERS = [
  { label: 'Low Stock', value: 'status:low_stock', color: 'warning' },
  { label: 'Out of Stock', value: 'status:out_of_stock', color: 'danger' },
  { label: 'Draft', value: 'visibility:draft', color: 'neutral' },
  { label: 'Wine', value: 'type:wine', color: 'secondary' },
  { label: 'Beer', value: 'type:beer', color: 'info' },
];

export default function EnhancedSearch({
  value,
  onChange,
  onSearch,
  onClear,
  isSearching = false,
  recentSearches = [],
  suggestions = [],
  placeholder = 'Search products, SKUs, categories...',
}: EnhancedSearchProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !isFocused && (e.target as HTMLElement).tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocused]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch();
      setShowDropdown(false);
    }
    if (e.key === 'Escape') {
      onClear();
      inputRef.current?.blur();
      setShowDropdown(false);
    }
  };
  
  const handleFocus = () => {
    setIsFocused(true);
    setShowDropdown(true);
  };
  
  const handleBlur = () => {
    setIsFocused(false);
    // Delay hiding to allow click events
    setTimeout(() => setShowDropdown(false), 200);
  };
  
  const handleSuggestionClick = (suggestion: SearchSuggestion | string) => {
    const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
    onChange(text);
    onSearch();
    setShowDropdown(false);
  };
  
  const handleQuickFilterClick = (filter: typeof QUICK_FILTERS[0]) => {
    onChange(filter.value);
    onSearch();
    setShowDropdown(false);
  };
  
  return (
    <div className="relative flex-1 max-w-2xl">
      {/* Search Input */}
      <motion.div
        animate={{
          scale: isFocused ? 1.01 : 1,
          boxShadow: isFocused 
            ? '0 10px 40px -10px rgba(59, 130, 246, 0.3)' 
            : '0 1px 3px rgba(0,0,0,0.1)',
        }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative rounded-2xl transition-all border-2 bg-white',
          isFocused ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
        )}
      >
        <div className="flex items-center">
          <motion.div
            animate={{ 
              scale: isSearching ? [1, 1.2, 1] : 1,
              rotate: isSearching ? 360 : 0,
            }}
            transition={{ 
              repeat: isSearching ? Infinity : 0, 
              duration: 1,
              ease: 'linear',
            }}
            className="pl-4"
          >
            {isSearching ? (
              <PiSpinnerGapBold className="w-5 h-5 text-blue-500" />
            ) : (
              <PiMagnifyingGlassBold className={cn(
                "w-5 h-5 transition-colors",
                isFocused ? "text-blue-500" : "text-gray-400"
              )} />
            )}
          </motion.div>
          
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 h-12 px-3 text-base bg-transparent border-0 outline-none placeholder:text-gray-400"
          />
          
          <Flex align="center" gap="2" className="pr-3">
            <AnimatePresence>
              {value && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => {
                    onClear();
                    inputRef.current?.focus();
                  }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <PiXBold className="w-4 h-4 text-gray-400" />
                </motion.button>
              )}
            </AnimatePresence>
            
            {/* Keyboard shortcut hint */}
            {!isFocused && !value && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hidden md:flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg"
              >
                <kbd className="text-xs font-mono text-gray-500">/</kbd>
              </motion.div>
            )}
            
            {/* Search button */}
            {value && (
              <motion.button
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  onSearch();
                  setShowDropdown(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                Search
                <PiArrowRightBold className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </Flex>
        </div>
      </motion.div>
      
      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden z-50"
          >
            {/* Quick Filters */}
            <div className="p-4 border-b border-gray-100">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Quick Filters
              </Text>
              <Flex wrap="wrap" gap="2">
                {QUICK_FILTERS.map((filter) => (
                  <motion.button
                    key={filter.value}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleQuickFilterClick(filter)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                      'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                    )}
                  >
                    {filter.label}
                  </motion.button>
                ))}
              </Flex>
            </div>
            
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="p-4 border-b border-gray-100">
                <Flex align="center" justify="between" className="mb-2">
                  <Flex align="center" gap="1.5">
                    <PiClockBold className="w-4 h-4 text-gray-400" />
                    <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Recent Searches
                    </Text>
                  </Flex>
                  <button className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                    Clear
                  </button>
                </Flex>
                <div className="space-y-1">
                  {recentSearches.slice(0, 5).map((search, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ x: 5, backgroundColor: 'rgb(249, 250, 251)' }}
                      onClick={() => handleSuggestionClick(search)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                    >
                      <PiClockBold className="w-4 h-4 text-gray-300" />
                      <Text className="text-sm text-gray-700">{search}</Text>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="p-4 border-b border-gray-100">
                <Flex align="center" gap="1.5" className="mb-2">
                  <PiTrendUpBold className="w-4 h-4 text-gray-400" />
                  <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Suggestions
                  </Text>
                </Flex>
                <div className="space-y-1">
                  {suggestions.slice(0, 5).map((suggestion, idx) => {
                    const Icon = suggestion.icon || PiPackageBold;
                    return (
                      <motion.button
                        key={idx}
                        whileHover={{ x: 5, backgroundColor: 'rgb(249, 250, 251)' }}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors"
                      >
                        <Icon className="w-4 h-4 text-gray-400" />
                        <div>
                          <Text className="text-sm text-gray-700">{suggestion.text}</Text>
                          {suggestion.subtitle && (
                            <Text className="text-xs text-gray-400">{suggestion.subtitle}</Text>
                          )}
                        </div>
                        <Badge size="xs" variant="flat" className="ml-auto capitalize">
                          {suggestion.type}
                        </Badge>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Search Tips */}
            <div className="px-4 py-3 bg-gray-50">
              <Flex align="center" gap="4">
                <PiKeyboardBold className="w-4 h-4 text-gray-400" />
                <Flex gap="4">
                  {SEARCH_TIPS.map((tip) => (
                    <Flex key={tip.key} align="center" gap="1.5">
                      <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px] font-mono text-gray-500">
                        {tip.key}
                      </kbd>
                      <Text className="text-xs text-gray-500">{tip.action}</Text>
                    </Flex>
                  ))}
                </Flex>
              </Flex>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
