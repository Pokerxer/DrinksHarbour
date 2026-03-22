import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icon from "react-icons/pi";
import { FilterState } from '@/types/filter.types';

interface BreadcrumbSectionProps {
  dataType: string | null;
  filters: FilterState;
  updateFilter: (key: keyof FilterState, value: any) => void;
  categoryTypes: string[];
  totalProducts?: number;
}

const categoryConfig: Record<string, { emoji: string; label: string; gradient: string; border: string }> = {
  wine: { emoji: '🍷', label: 'Wine', gradient: 'from-red-500 to-rose-600', border: 'border-red-300' },
  beer: { emoji: '🍺', label: 'Beer', gradient: 'from-amber-500 to-orange-600', border: 'border-amber-300' },
  whiskey: { emoji: '🥃', label: 'Whiskey', gradient: 'from-amber-700 to-yellow-600', border: 'border-amber-600' },
  vodka: { emoji: '❄️', label: 'Vodka', gradient: 'from-sky-500 to-blue-600', border: 'border-sky-300' },
  gin: { emoji: '🌿', label: 'Gin', gradient: 'from-emerald-500 to-teal-600', border: 'border-emerald-300' },
  rum: { emoji: '🏴‍☠️', label: 'Rum', gradient: 'from-amber-600 to-yellow-700', border: 'border-amber-500' },
  tequila: { emoji: '🌵', label: 'Tequila', gradient: 'from-lime-500 to-green-600', border: 'border-lime-400' },
  champagne: { emoji: '🍾', label: 'Champagne', gradient: 'from-yellow-400 to-amber-500', border: 'border-yellow-300' },
  brandy: { emoji: '🍷', label: 'Brandy', gradient: 'from-orange-700 to-red-800', border: 'border-orange-600' },
  liqueur: { emoji: '🍯', label: 'Liqueur', gradient: 'from-purple-500 to-violet-600', border: 'border-purple-300' },
  cognac: { emoji: '🥃', label: 'Cognac', gradient: 'from-amber-800 to-orange-900', border: 'border-amber-700' },
  schnapps: { emoji: '🍎', label: 'Schnapps', gradient: 'from-pink-500 to-red-600', border: 'border-pink-300' },
  sake: { emoji: '🍶', label: 'Sake', gradient: 'from-gray-400 to-gray-600', border: 'border-gray-300' },
  cider: { emoji: '🍎', label: 'Cider', gradient: 'from-green-500 to-emerald-600', border: 'border-green-300' },
  non_alcoholic: { emoji: '🚫', label: 'Non-Alcoholic', gradient: 'from-cyan-500 to-blue-600', border: 'border-cyan-300' },
};

const BreadcrumbSection: React.FC<BreadcrumbSectionProps> = ({ 
  dataType, 
  filters, 
  updateFilter, 
  categoryTypes,
  totalProducts = 0
}) => {
  const displayTitle = dataType?.replace(/_/g, ' ') || 'Shop';

  const handleTabClick = (item: string) => {
    updateFilter('type', filters.type === item ? null : item);
  };

  const handleTabKeyDown = (e: React.KeyboardEvent, item: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabClick(item);
    }
  };

  const handleAllClick = () => {
    updateFilter('type', null);
  };

  const getCategoryInfo = (type: string) => {
    const normalizedType = type.toLowerCase().replace(/\s+/g, '_');
    return categoryConfig[normalizedType] || {
      emoji: '🍹',
      label: type.replace(/_/g, ' '),
      gradient: 'from-gray-500 to-gray-600',
      border: 'border-gray-300'
    };
  };

  return (
    <div className="breadcrumb-block style-img">
      <div className="breadcrumb-main bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="container lg:pt-24 pt-20 pb-6 relative">
          <div className="main-content w-full flex flex-col items-center justify-center relative z-[1]">
            {/* Title Section */}
            <div className="text-content text-center mb-6">
              <h1 className="text-3xl md:text-4xl font-black text-gray-900 capitalize">
                {displayTitle}
              </h1>
              <nav className="link flex items-center justify-center gap-1 text-sm mt-2 text-gray-500" aria-label="Breadcrumb">
                <Link href="/" className="hover:text-gray-900 transition-colors">
                  Homepage
                </Link>
                <Icon.PiCaretRight size={14} />
                <span className="capitalize">
                  {displayTitle}
                </span>
              </nav>
            </div>

            {/* Category Quick Links */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-4xl mx-auto"
            >
              <div className="flex items-center justify-center flex-wrap gap-2 sm:gap-3">
                {/* All Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAllClick}
                  className={`px-4 py-2 sm:px-5 sm:py-2.5 rounded-full font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                    !filters.type
                      ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/25'
                      : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  <Icon.PiGridFour size={16} />
                  <span>All</span>
                  <span className="hidden sm:inline text-xs opacity-70">({totalProducts})</span>
                </motion.button>

                {/* Category Buttons */}
                {categoryTypes.slice(0, 8).map((type) => {
                  const info = getCategoryInfo(type);
                  const isActive = filters.type === type;
                  
                  return (
                    <motion.button
                      key={type}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleTabClick(type)}
                      className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-full font-semibold text-sm transition-all duration-200 flex items-center gap-1.5 sm:gap-2 border ${
                        isActive
                          ? `bg-gradient-to-r ${info.gradient} text-white shadow-lg border-transparent`
                          : `bg-white ${info.border} text-gray-700 hover:bg-gray-50`
                      }`}
                    >
                      <span className="text-base sm:text-lg">{info.emoji}</span>
                      <span className="hidden sm:inline capitalize">{info.label}</span>
                      {isActive && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="ml-1"
                        >
                          <Icon.PiCheck size={14} />
                        </motion.span>
                      )}
                    </motion.button>
                  );
                })}

                {/* More Button if needed */}
                {categoryTypes.length > 8 && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 rounded-full font-semibold text-sm bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2"
                  >
                    <Icon.PiDotsThree size={16} />
                    <span>More</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BreadcrumbSection;
