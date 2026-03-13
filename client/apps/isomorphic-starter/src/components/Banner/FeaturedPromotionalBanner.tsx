'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { motion } from 'framer-motion';

interface FeaturedBannerData {
  _id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: 'featured';
  placement: string;
  ctaText?: string;
  ctaLink?: string;
  ctaStyle?: string;
  backgroundColor?: string;
  textColor?: string;
  image: {
    url: string;
    alt?: string;
  };
  endDate?: string;
  discount?: string;
}

const defaultFeaturedBanner: FeaturedBannerData = {
  _id: 'featured-1',
  title: 'Hot Deal: Premium Whiskey Bundle',
  subtitle: 'Limited Time Offer',
  description: 'Get the ultimate whiskey experience with our specially curated bundle. Includes Glenfiddich 18, Macallan 12, and more!',
  type: 'featured',
  placement: 'home_featured',
  ctaText: 'Shop the Bundle - Save ₦15,000',
  ctaLink: '/shop?bundle=whiskey-premium',
  ctaStyle: 'primary',
  backgroundColor: '#1A1A2E',
  image: {
    url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=1600',
    alt: 'Premium whiskey bundle'
  },
  discount: 'SAVE ₦15K'
};

const CountdownTimer = ({ endDate }: { endDate?: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const targetDate = endDate ? new Date(endDate) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate.getTime() - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [endDate]);

  return (
    <div className="flex items-center gap-3 mt-4">
      {[
        { value: timeLeft.days, label: 'Days' },
        { value: timeLeft.hours, label: 'Hours' },
        { value: timeLeft.minutes, label: 'Mins' },
        { value: timeLeft.seconds, label: 'Secs' }
      ].map((item, index) => (
        <React.Fragment key={item.label}>
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-xl px-3 py-2 min-w-[52px] text-center shadow-lg">
              <span className="text-gray-900 font-bold text-xl">{String(item.value).padStart(2, '0')}</span>
            </div>
            <span className="text-white/60 text-xs mt-1">{item.label}</span>
          </div>
          {index < 3 && <span className="text-white/40 text-lg font-bold -mt-4">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

const FeaturedPromotionalBanner = () => {
  const [banner, setBanner] = useState<FeaturedBannerData>(defaultFeaturedBanner);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const fetchBanner = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5001/api/banners/placement/home_featured?limit=1');
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.length > 0) {
            setBanner(data.data[0]);
          }
        }
      } catch (err) {
        console.log('Using default featured banner');
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, []);

  if (loading) {
    return (
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="relative w-full h-[400px] md:h-[500px] rounded-3xl bg-gray-200 animate-pulse"></div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative w-full h-[400px] md:h-[500px] rounded-3xl overflow-hidden group"
        >
          <Link href={banner.ctaLink || '#'} className="block w-full h-full">
            <div className="absolute inset-0">
              <Image
                src={imgError ? '/images/placeholder-product.png' : banner.image.url}
                alt={banner.image.alt || banner.title}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-105"
                priority
                sizes="100vw"
                onError={() => setImgError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-gray-900 via-gray-900/80 to-transparent md:w-2/3" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            </div>

            <div className="absolute inset-0 flex items-center">
              <div className="w-full md:w-3/5 px-6 md:px-12">
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6 }}
                >
                  {banner.subtitle && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-full">
                        <Icon.PiFireFill size={12} />
                        {banner.subtitle}
                      </span>
                    </div>
                  )}

                  {banner.discount && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', delay: 0.2 }}
                      className="inline-block bg-gradient-to-r from-green-500 to-green-600 text-white px-5 py-2 rounded-xl font-black text-2xl md:text-3xl shadow-lg shadow-green-500/25 mb-4"
                    >
                      {banner.discount}
                    </motion.div>
                  )}

                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight"
                  >
                    {banner.title}
                  </motion.h2>

                  {banner.description && (
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-white/80 text-lg md:text-xl mb-6 max-w-xl leading-relaxed"
                    >
                      {banner.description}
                    </motion.p>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex flex-wrap items-center gap-6"
                  >
                    <CountdownTimer endDate={banner.endDate} />

                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 rounded-full font-bold text-lg shadow-xl hover:shadow-2xl transition-all">
                        {banner.ctaText}
                        <Icon.PiArrowRight size={20} />
                      </span>
                    </motion.div>
                  </motion.div>
                </motion.div>
              </div>
            </div>

            <div className="absolute top-6 right-6 hidden md:flex">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-md rounded-full"
              >
                <Icon.PiTruck size={18} className="text-white" />
                <span className="text-white text-sm font-medium">Free Delivery</span>
              </motion.div>
            </div>

            <div className="absolute bottom-6 right-6 hidden lg:flex items-center gap-4">
              {[
                { icon: Icon.PiShieldCheck, label: 'Secure Payment' },
                { icon: Icon.PiArrowUUpLeft, label: 'Easy Returns' },
                { icon: Icon.PiHeadset, label: '24/7 Support' }
              ].map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full"
                >
                  <item.icon size={16} className="text-white/80" />
                  <span className="text-white/80 text-xs">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturedPromotionalBanner;
