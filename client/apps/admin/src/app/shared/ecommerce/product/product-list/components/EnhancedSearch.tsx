// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Badge, Flex } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiMagnifyingGlassBold,
  PiXBold,
  PiClockBold,
  PiTrendUpBold,
  PiPackageBold,
  PiArrowRightBold,
  PiKeyboardBold,
  PiSpinnerGapBold,
} from 'react-icons/pi';

interface SearchSuggestion {
  type: 'recent' | 'product' | 'brand' | 'category';
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
  placeholder = 'Search products, brands, categories...',
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
      if (
        e.key === '/' &&
        !isFocused &&
        (e.target as HTMLElement).tagName !== 'INPUT'
      ) {
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

  const handleQuickFilterClick = (filter: (typeof QUICK_FILTERS)[0]) => {
    onChange(filter.value);
    onSearch();
    setShowDropdown(false);
  };

  return (
    <div className="relative max-w-2xl flex-1">
      {/* Search Input */}
      <motion.div
        animate={{
          scale: isFocused ? 1.01 : 1,
          boxShadow: isFocused
            ? '0 10px 40px -10px rgba(178, 2, 2, 0.3)'
            : '0 1px 3px rgba(0,0,0,0.1)',
        }}
        transition={{ duration: 0.2 }}
        className={cn(
          'relative rounded-2xl border-2 bg-white transition-all',
          isFocused
            ? 'border-[#b20202]'
            : 'border-gray-200 hover:border-gray-300'
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
              <PiSpinnerGapBold className="h-5 w-5 text-[#b20202]" />
            ) : (
              <PiMagnifyingGlassBold
                className={cn(
                  'h-5 w-5 transition-colors',
                  isFocused ? 'text-[#b20202]' : 'text-gray-400'
                )}
              />
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
            className="h-12 flex-1 border-0 bg-transparent px-3 text-base outline-none placeholder:text-gray-400"
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
                  className="rounded-lg p-1.5 transition-colors hover:bg-gray-100"
                >
                  <PiXBold className="h-4 w-4 text-gray-400" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Keyboard shortcut hint */}
            {!isFocused && !value && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="hidden items-center gap-1 rounded-lg bg-gray-100 px-2 py-1 md:flex"
              >
                <kbd className="font-mono text-xs text-gray-500">/</kbd>
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
                className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#7f1d1d]"
              >
                Search
                <PiArrowRightBold className="h-3.5 w-3.5" />
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
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
          >
            {/* Quick Filters */}
            <div className="border-b border-gray-100 p-4">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
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
                      'rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                      'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {filter.label}
                  </motion.button>
                ))}
              </Flex>
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="border-b border-gray-100 p-4">
                <Flex align="center" justify="between" className="mb-2">
                  <Flex align="center" gap="1.5">
                    <PiClockBold className="h-4 w-4 text-gray-400" />
                    <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Recent Searches
                    </Text>
                  </Flex>
                  <button className="text-xs font-medium text-[#b20202] hover:text-[#7f1d1d]">
                    Clear
                  </button>
                </Flex>
                <div className="space-y-1">
                  {recentSearches.slice(0, 5).map((search, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{
                        x: 5,
                        backgroundColor: 'rgb(249, 250, 251)',
                      }}
                      onClick={() => handleSuggestionClick(search)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                    >
                      <PiClockBold className="h-4 w-4 text-gray-300" />
                      <Text className="text-sm text-gray-700">{search}</Text>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="border-b border-gray-100 p-4">
                <Flex align="center" gap="1.5" className="mb-2">
                  <PiTrendUpBold className="h-4 w-4 text-gray-400" />
                  <Text className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Suggestions
                  </Text>
                </Flex>
                <div className="space-y-1">
                  {suggestions.slice(0, 5).map((suggestion, idx) => {
                    const Icon = suggestion.icon || PiPackageBold;
                    return (
                      <motion.button
                        key={idx}
                        whileHover={{
                          x: 5,
                          backgroundColor: 'rgb(249, 250, 251)',
                        }}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors"
                      >
                        <Icon className="h-4 w-4 text-gray-400" />
                        <div>
                          <Text className="text-sm text-gray-700">
                            {suggestion.text}
                          </Text>
                          {suggestion.subtitle && (
                            <Text className="text-xs text-gray-400">
                              {suggestion.subtitle}
                            </Text>
                          )}
                        </div>
                        <Badge
                          size="xs"
                          variant="flat"
                          className="ml-auto capitalize"
                        >
                          {suggestion.type}
                        </Badge>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Tips */}
            <div className="bg-gray-50 px-4 py-3">
              <Flex align="center" gap="4">
                <PiKeyboardBold className="h-4 w-4 text-gray-400" />
                <Flex gap="4">
                  {SEARCH_TIPS.map((tip) => (
                    <Flex key={tip.key} align="center" gap="1.5">
                      <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                        {tip.key}
                      </kbd>
                      <Text className="text-xs text-gray-500">
                        {tip.action}
                      </Text>
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
