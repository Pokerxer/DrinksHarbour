'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination } from 'swiper/modules';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import 'swiper/css';
import 'swiper/css/pagination';

interface InstagramPost {
  id: number;
  src: string;
  alt: string;
  likes: number;
  comments: number;
}

const instagramPosts: InstagramPost[] = [
  { id: 1, src: '/images/instagram/1.png', alt: 'Premium Wine Collection', likes: 1243, comments: 89 },
  { id: 2, src: '/images/instagram/2.png', alt: 'Craft Beer Selection', likes: 987, comments: 56 },
  { id: 3, src: '/images/instagram/3.png', alt: 'Luxury Champagne', likes: 2156, comments: 142 },
  { id: 4, src: '/images/instagram/4.png', alt: 'Fine Spirits', likes: 1567, comments: 98 },
  { id: 5, src: '/images/instagram/5.png', alt: 'Exclusive Bottles', likes: 1890, comments: 115 },
];

const Instagram: React.FC = () => {
  const [hoveredPost, setHoveredPost] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 30, scale: 0.9 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15
      }
    }
  };

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-purple-50/30 to-white pointer-events-none" />
      
      {/* Decorative Elements */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-pink-200/20 to-purple-200/20 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        className="absolute -bottom-20 -left-20 w-72 h-72 bg-gradient-to-br from-blue-200/20 to-pink-200/20 rounded-full blur-3xl"
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          {/* Instagram Icon Badge */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={isVisible ? { scale: 1, rotate: 0 } : {}}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 rounded-2xl shadow-lg shadow-pink-500/30 mb-6"
          >
            <Icon.PiInstagramLogo size={32} className="text-white" />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
          >
            Follow Us on{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500">
              Instagram
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : {}}
            transition={{ delay: 0.4 }}
            className="text-gray-500 text-lg max-w-xl mx-auto mb-6"
          >
            Get inspired by our curated collection and join the conversation
          </motion.p>

          {/* Hashtag */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={isVisible ? { opacity: 1, scale: 1 } : {}}
            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 rounded-full font-medium text-gray-700 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <Icon.PiHash size={18} className="text-pink-500" />
            DrinkHarbour
          </motion.div>
        </motion.div>

        {/* Instagram Feed Carousel */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isVisible ? 'visible' : 'hidden'}
          className="relative"
        >
          <Swiper
            spaceBetween={16}
            slidesPerView={2}
            loop={true}
            speed={600}
            modules={[Autoplay, Pagination]}
            autoplay={{ 
              delay: 3000, 
              disableOnInteraction: false,
              pauseOnMouseEnter: true 
            }}
            pagination={{
              clickable: true,
              dynamicBullets: true
            }}
            breakpoints={{
              320: { slidesPerView: 1.5, spaceBetween: 12 },
              500: { slidesPerView: 2, spaceBetween: 16 },
              680: { slidesPerView: 3, spaceBetween: 16 },
              992: { slidesPerView: 4, spaceBetween: 16 },
              1200: { slidesPerView: 5, spaceBetween: 16 },
            }}
            className="instagram-swiper pb-12"
          >
            {instagramPosts.map((post, index) => (
              <SwiperSlide key={post.id}>
                <motion.div
                  variants={itemVariants}
                  className="relative group"
                  onMouseEnter={() => setHoveredPost(post.id)}
                  onMouseLeave={() => setHoveredPost(null)}
                >
                  <Link
                    href="https://www.instagram.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative block aspect-square rounded-3xl overflow-hidden shadow-lg"
                  >
                    {/* Image */}
                    <motion.div
                      className="absolute inset-0"
                      animate={{ 
                        scale: hoveredPost === post.id ? 1.1 : 1 
                      }}
                      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                    >
                      <Image
                        src={post.src}
                        alt={post.alt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 500px) 50vw, (max-width: 680px) 33vw, (max-width: 992px) 25vw, 20vw"
                      />
                    </motion.div>

                    {/* Hover Overlay */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: hoveredPost === post.id ? 1 : 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
                    />

                    {/* Instagram Icon */}
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ 
                        scale: hoveredPost === post.id ? 1 : 0,
                        opacity: hoveredPost === post.id ? 1 : 0
                      }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
                    >
                      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl">
                        <Icon.PiInstagramLogo size={32} className="text-pink-500" />
                      </div>
                    </motion.div>

                    {/* Stats Overlay */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ 
                        opacity: hoveredPost === post.id ? 1 : 0,
                        y: hoveredPost === post.id ? 0 : 20
                      }}
                      transition={{ duration: 0.3 }}
                      className="absolute bottom-0 left-0 right-0 p-4 z-10"
                    >
                      <div className="flex items-center justify-center gap-6 text-white">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: hoveredPost === post.id ? 1 : 0 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                          className="flex items-center gap-2"
                        >
                          <Icon.PiHeartFill size={20} className="text-red-400" />
                          <span className="font-semibold">{post.likes.toLocaleString()}</span>
                        </motion.div>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: hoveredPost === post.id ? 1 : 0 }}
                          transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                          className="flex items-center gap-2"
                        >
                          <Icon.PiChatCircleFill size={20} className="text-blue-400" />
                          <span className="font-semibold">{post.comments}</span>
                        </motion.div>
                      </div>
                    </motion.div>

                    {/* Corner Decoration */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ 
                        opacity: hoveredPost === post.id ? 1 : 0,
                        scale: hoveredPost === post.id ? 1 : 0
                      }}
                      className="absolute top-3 right-3 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                    >
                      <Icon.PiArrowUpRight size={20} className="text-white" />
                    </motion.div>
                  </Link>
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Custom Navigation - Hidden dots handled by Swiper */}
        </motion.div>

        {/* Follow CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
          className="text-center mt-8"
        >
          <Link
            href="https://www.instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 20px 40px -10px rgba(236, 72, 153, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white font-semibold rounded-full shadow-lg shadow-pink-500/25 hover:shadow-xl transition-all"
            >
              <Icon.PiInstagramLogo size={24} />
              Follow @DrinkHarbour
              <motion.span
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                <Icon.PiArrowRight size={18} />
              </motion.span>
            </motion.button>
          </Link>
        </motion.div>
      </div>

      {/* Custom Styles for Swiper Pagination */}
      <style jsx global>{`
        .instagram-swiper .swiper-pagination {
          bottom: 0 !important;
        }
        .instagram-swiper .swiper-pagination-bullet {
          width: 10px;
          height: 10px;
          background: #cbd5e1;
          opacity: 1;
          transition: all 0.3s ease;
        }
        .instagram-swiper .swiper-pagination-bullet-active {
          width: 24px;
          border-radius: 5px;
          background: linear-gradient(to right, #9333ea, #ec4899);
        }
      `}</style>
    </section>
  );
};

export default Instagram;
