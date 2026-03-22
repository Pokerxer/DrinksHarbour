'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface FeaturedDealsBannerProps {
  onClose?: () => void;
}

const featuredDeals = [
  {
    id: 1,
    emoji: '🔥',
    title: 'Hot Deals',
    subtitle: 'Up to 50% off',
    gradient: 'from-red-500 to-orange-500',
    href: '/shop?sale=true',
  },
  {
    id: 2,
    emoji: '🍺',
    title: 'Beer Bonanza',
    subtitle: 'Buy 3 Get 1 Free',
    gradient: 'from-amber-500 to-yellow-500',
    href: '/shop?type=beer',
  },
  {
    id: 3,
    emoji: '🍷',
    title: 'Wine Weekend',
    subtitle: '20% Off All Reds',
    gradient: 'from-red-600 to-rose-600',
    href: '/shop?type=wine',
  },
  {
    id: 4,
    emoji: '🥃',
    title: 'Whiskey Sale',
    subtitle: 'Premium Bottles from ₦8k',
    gradient: 'from-amber-700 to-orange-600',
    href: '/shop?type=whiskey',
  },
  {
    id: 5,
    emoji: '🎉',
    title: 'Flash Sale',
    subtitle: 'Ends in 24hrs',
    gradient: 'from-purple-500 to-pink-500',
    href: '/shop?sale=true',
  },
];

const FeaturedDealsBanner: React.FC<FeaturedDealsBannerProps> = ({ onClose }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="w-full bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700"
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {/* Label */}
          <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-full">
            <Icon.PiFire size={16} />
            <span className="text-xs font-bold whitespace-nowrap">Hot Deals</span>
          </div>

          {/* Scrollable Deals */}
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1">
            {featuredDeals.map((deal) => (
              <Link
                key={deal.id}
                href={deal.href}
                className="flex-shrink-0 group"
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${deal.gradient} text-white shadow-lg group-hover:shadow-xl transition-shadow`}
                >
                  <span className="text-lg">{deal.emoji}</span>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold leading-tight">{deal.title}</span>
                    <span className="text-[10px] opacity-90 leading-tight">{deal.subtitle}</span>
                  </div>
                  <Icon.PiArrowRight size={14} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </motion.div>
              </Link>
            ))}
          </div>

          {/* View All */}
          <Link
            href="/shop?sale=true"
            className="flex-shrink-0 ml-auto"
          >
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-gray-900 font-semibold text-sm shadow-md hover:shadow-lg transition-shadow"
            >
              <span>View All</span>
              <Icon.PiArrowRight size={14} />
            </motion.div>
          </Link>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-32 h-full bg-gradient-to-r from-gray-900 to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-gray-900 to-transparent pointer-events-none" />
    </motion.div>
  );
};

export default FeaturedDealsBanner;
