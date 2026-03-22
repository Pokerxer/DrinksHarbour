'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface SocialPost {
  id: number;
  image: string;
  emoji: string;
  title: string;
  subtitle: string;
  likes: number;
  comments: number;
  type: 'wine' | 'beer' | 'spirit' | 'food' | 'event';
}

const socialPosts: SocialPost[] = [
  { id: 1, image: '/images/instagram/1.png', emoji: '🍷', title: 'Wine Wednesday', subtitle: 'Fine reds & whites', likes: 2341, comments: 156, type: 'wine' },
  { id: 2, image: '/images/instagram/2.png', emoji: '🍺', title: 'Craft Night', subtitle: 'Local breweries', likes: 1876, comments: 98, type: 'beer' },
  { id: 3, image: '/images/instagram/3.png', emoji: '🥃', title: 'Whiskey Tasting', subtitle: 'Premium selections', likes: 3156, comments: 234, type: 'spirit' },
  { id: 4, image: '/images/instagram/4.png', emoji: '🧀', title: 'Pairing Guide', subtitle: 'Wine & cheese night', likes: 1234, comments: 87, type: 'food' },
  { id: 5, image: '/images/instagram/5.png', emoji: '🎉', title: 'Weekend Sale', subtitle: 'Up to 40% off', likes: 4521, comments: 312, type: 'event' },
  { id: 6, image: '/images/instagram/6.png', emoji: '🍾', title: 'Champagne Hour', subtitle: 'Celebrate in style', likes: 2890, comments: 178, type: 'wine' },
];

const getTypeGradient = (type: SocialPost['type']) => {
  switch (type) {
    case 'wine': return 'from-red-500/80 to-rose-500/80';
    case 'beer': return 'from-amber-500/80 to-orange-500/80';
    case 'spirit': return 'from-yellow-500/80 to-amber-500/80';
    case 'food': return 'from-emerald-500/80 to-teal-500/80';
    case 'event': return 'from-purple-500/80 to-pink-500/80';
  }
};

const getTypeBadge = (type: SocialPost['type']) => {
  switch (type) {
    case 'wine': return { icon: '🍷', label: 'Wine' };
    case 'beer': return { icon: '🍺', label: 'Beer' };
    case 'spirit': return { icon: '🥃', label: 'Spirits' };
    case 'food': return { icon: '🧀', label: 'Pairing' };
    case 'event': return { icon: '🎉', label: 'Event' };
  }
};

const formatNumber = (num: number) => {
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const Instagram: React.FC = () => {
  const [hoveredPost, setHoveredPost] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const filters = [
    { id: 'all', label: 'All Posts', icon: <Icon.PiGridFour size={16} /> },
    { id: 'wine', label: 'Wines', icon: '🍷' },
    { id: 'beer', label: 'Beers', icon: '🍺' },
    { id: 'spirit', label: 'Spirits', icon: '🥃' },
    { id: 'event', label: 'Events', icon: '🎉' },
  ];

  const filteredPosts = useMemo(() => {
    if (activeFilter === 'all') return socialPosts;
    return socialPosts.filter(post => post.type === activeFilter);
  }, [activeFilter]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1
      }
    }
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 40, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring' as const,
        stiffness: 100,
        damping: 12
      }
    }
  };

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-rose-50/20 to-white" />

      {/* Animated Background */}
      <motion.div
        animate={{ 
          scale: [1, 1.2, 1],
          opacity: [0.2, 0.4, 0.2],
          rotate: [0, 5, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-rose-200/30 to-purple-200/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.35, 0.15]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-amber-200/25 to-orange-200/15 rounded-full blur-3xl"
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-rose-100 to-amber-100 rounded-full text-sm font-semibold mb-6 shadow-sm border border-rose-200/50"
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Icon.PiHeart size={16} className="text-rose-500" />
            </motion.span>
            <span className="bg-gradient-to-r from-rose-600 to-amber-600 bg-clip-text text-transparent">
              Join Our Community
            </span>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-5"
          >
            Follow the
            <span className="block mt-1 text-transparent bg-clip-text bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500">
              Flavor Journey
            </span>
          </motion.h2>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-gray-500 text-lg md:text-xl max-w-xl mx-auto mb-8"
          >
            Discover curated beverage experiences, pairing guides, and exclusive offers
          </motion.p>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 flex-wrap"
          >
            {filters.map((filter) => (
              <motion.button
                key={filter.id}
                onClick={() => setActiveFilter(filter.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeFilter === filter.id
                    ? 'bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-500/25'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  {filter.icon}
                  {filter.label}
                </span>
              </motion.button>
            ))}
          </motion.div>
        </motion.div>

        {/* Posts Grid */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeFilter}
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 md:gap-5"
          >
            {filteredPosts.map((post, index) => {
              const typeBadge = getTypeBadge(post.type);
              const isHovered = hoveredPost === post.id;
              const hasError = imageErrors[post.id];

              return (
                <motion.div
                  key={post.id}
                  variants={cardVariants}
                  className={`relative group ${index === 0 ? 'md:col-span-2 md:row-span-2' : ''}`}
                  onMouseEnter={() => setHoveredPost(post.id)}
                  onMouseLeave={() => setHoveredPost(null)}
                >
                  <motion.div
                    layoutId={`card-${post.id}`}
                    className={`relative overflow-hidden rounded-3xl ${
                      index === 0 ? 'aspect-square md:aspect-auto md:h-full' : 'aspect-square'
                    } bg-gradient-to-br ${getTypeGradient(post.type)} shadow-lg group-hover:shadow-2xl transition-shadow duration-500`}
                  >
                    {/* Image or Emoji Placeholder */}
                    {!hasError ? (
                      <Image
                        src={post.image}
                        alt={post.title}
                        fill
                        className={`object-cover transition-all duration-700 ${
                          isHovered ? 'scale-110' : 'scale-100'
                        } ${hasError ? 'hidden' : ''}`}
                        onError={() => setImageErrors(prev => ({ ...prev, [post.id]: true }))}
                        sizes="(max-width: 768px) 50vw, 16vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                        <span className={`${index === 0 ? 'text-8xl' : 'text-5xl'}`}>
                          {post.emoji}
                        </span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isHovered ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"
                    />

                    {/* Type Badge */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: isHovered ? 1 : 0, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute top-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold text-gray-800 flex items-center gap-1.5 shadow-lg"
                    >
                      <span>{typeBadge.icon}</span>
                      <span>{typeBadge.label}</span>
                    </motion.div>

                    {/* Heart Icon */}
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ 
                        scale: isHovered ? 1 : 0, 
                        opacity: isHovered ? 1 : 0 
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg"
                    >
                      <Icon.PiInstagramLogo size={20} className="text-rose-500" />
                    </motion.div>

                    {/* Content */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-x-0 bottom-0 p-4 md:p-6"
                    >
                      {/* Title */}
                      <h3 className={`font-black text-white mb-1 ${index === 0 ? 'text-xl md:text-2xl' : 'text-sm md:text-base'}`}>
                        {post.title}
                      </h3>
                      <p className={`text-white/80 ${index === 0 ? 'text-sm md:text-base' : 'text-xs'}`}>
                        {post.subtitle}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center gap-4 mt-3">
                        <div className="flex items-center gap-1.5 text-white">
                          <motion.div
                            animate={isHovered ? { scale: [1, 1.3, 1] } : {}}
                            transition={{ duration: 0.5, repeat: isHovered ? Infinity : 0 }}
                          >
                            <Icon.PiHeartFill size={16} className="text-rose-400" />
                          </motion.div>
                          <span className="text-sm font-semibold">{formatNumber(post.likes)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-white">
                          <Icon.PiChatCircleFill size={16} className="text-blue-400" />
                          <span className="text-sm font-semibold">{post.comments}</span>
                        </div>
                      </div>

                      {/* CTA */}
                      {index === 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
                          transition={{ delay: 0.1 }}
                          className="mt-4"
                        >
                          <Link
                            href="/shop"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-900 font-bold rounded-full text-sm hover:bg-gray-100 transition-colors"
                          >
                            <Icon.PiShoppingBag size={16} />
                            Shop Now
                          </Link>
                        </motion.div>
                      )}
                    </motion.div>

                    {/* Tap Indicator */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: isHovered ? 1 : 0 }}
                      className="absolute inset-0 border-2 border-white/30 rounded-3xl pointer-events-none"
                    />
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>
        </AnimatePresence>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-8 md:gap-12 mt-12 flex-wrap"
        >
          {[
            { value: '25K+', label: 'Followers', icon: <Icon.PiUsers size={20} /> },
            { value: '500+', label: 'Posts', icon: <Icon.PiImages size={20} /> },
            { value: '98%', label: 'Happy', icon: <Icon.PiSmiley size={20} /> },
          ].map((stat, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-md border border-gray-100"
            >
              <span className="text-rose-500">{stat.icon}</span>
              <div>
                <div className="text-xl font-black text-gray-900">{stat.value}</div>
                <div className="text-xs text-gray-500">{stat.label}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <motion.a
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white font-bold rounded-full shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group"
          >
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              initial={{ x: '-100%' }}
              whileHover={{ x: '100%' }}
              transition={{ duration: 0.8 }}
            />
            <Icon.PiInstagramLogo size={24} className="relative z-10" />
            <span className="relative z-10">Follow @DrinkHarbour</span>
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="relative z-10"
            >
              <Icon.PiArrowRight size={20} />
            </motion.span>
          </motion.a>

          <p className="text-gray-400 text-sm mt-4">
            Tag us for a chance to be featured
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Instagram;
