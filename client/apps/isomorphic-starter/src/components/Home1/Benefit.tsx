'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import * as Icon from 'react-icons/pi';
import 'swiper/css';

interface BenefitStat {
  value: number;
  suffix: string;
  label: string;
}

interface BenefitItem {
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  hoverGradient: string;
  stats?: BenefitStat;
}

interface BenefitProps {
  className?: string;
}

const AnimatedCounter = ({ value, suffix }: { value: number; suffix: string }) => {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000;
          const increment = value / (duration / 16);
          const timer = setInterval(() => {
            start += increment;
            if (start >= value) {
              setCount(value);
              clearInterval(timer);
            } else {
              setCount(Math.floor(start));
            }
          }, 16);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value, hasAnimated]);

  return <span ref={ref}>{count}{suffix}</span>;
};

const benefits: BenefitItem[] = [
  {
    icon: <Icon.PiWine size={36} />,
    activeIcon: <Icon.PiWineFill size={36} />,
    title: 'Premium Selection',
    description: 'Curated collection of fine wines, craft beers, and premium spirits from world-renowned producers',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    hoverGradient: 'from-red-500/10',
    stats: { value: 500, suffix: '+', label: 'Premium Brands' }
  },
  {
    icon: <Icon.PiTruck size={36} />,
    activeIcon: <Icon.PiTruckFill size={36} />,
    title: 'Express Delivery',
    description: 'Lightning-fast delivery across Nigeria with temperature-controlled packaging for perfect quality',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverGradient: 'from-blue-500/10',
    stats: { value: 30, suffix: 'min', label: 'Avg. Delivery' }
  },
  {
    icon: <Icon.PiShieldCheck size={36} />,
    activeIcon: <Icon.PiShieldCheckFill size={36} />,
    title: 'Age Verified',
    description: 'Secure age verification system ensuring all deliveries comply with regulations',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    hoverGradient: 'from-emerald-500/10',
    stats: { value: 100, suffix: '%', label: 'Compliant' }
  },
  {
    icon: <Icon.PiMedal size={36} />,
    activeIcon: <Icon.PiMedalFill size={36} />,
    title: 'Quality Guaranteed',
    description: 'Every bottle inspected and authenticated. Money-back guarantee on all purchases',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    hoverGradient: 'from-amber-500/10',
    stats: { value: 50, suffix: 'K+', label: 'Happy Customers' }
  }
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2
    }
  }
};

const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.95
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 100,
      damping: 12,
      duration: 0.5
    }
  }
};

const iconFloatVariants: Variants = {
  rest: { y: 0, rotate: 0 },
  hover: {
    y: [-2, 2, -2],
    rotate: [0, -5, 5, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  }
};

const Benefit: React.FC<BenefitProps> = ({ className = '' }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className={`py-8 md:py-12 lg:py-20 relative overflow-hidden ${className}`}>
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-red-50/30" />
      
      {/* Animated Background Shapes */}
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
          x: [0, 30, 0]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-red-200/40 to-transparent rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.2, 0.4, 0.2],
          x: [0, -20, 0]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute -bottom-10 -right-10 w-80 h-80 bg-gradient-to-tl from-emerald-200/30 to-transparent rounded-full blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.25, 0.45, 0.25]
        }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-amber-100/20 to-transparent rounded-full blur-3xl"
      />

      {/* Floating Particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className={`absolute w-2 h-2 rounded-full ${
            i % 3 === 0 ? 'bg-red-400/50' : i % 3 === 1 ? 'bg-emerald-400/50' : 'bg-amber-400/50'
          }`}
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`
          }}
          animate={{
            y: [0, -20, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.2, 1]
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3
          }}
        />
      ))}

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="text-center mb-8 lg:mb-16"
        >
          {/* Title - Smaller on mobile */}
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 mb-3 lg:mb-6"
          >
            Why Choose Us
          </motion.h2>

          {/* Subtitle - Smaller on mobile */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-gray-500 text-sm md:text-base lg:text-lg max-w-2xl mx-auto"
          >
            Premium quality with{' '}
            <span className="text-red-600 font-semibold">fast delivery</span> 
            {' '}and{' '}
            <span className="text-emerald-600 font-semibold">guaranteed authenticity</span>
          </motion.p>
        </motion.div>

        {/* Benefits Slider - Mobile / Grid - Desktop */}
        <div className="lg:hidden">
          <Swiper
            modules={[Autoplay]}
            autoplay={{ delay: 3000, disableOnInteraction: true }}
            loop={true}
            spaceBetween={16}
            slidesPerView={1.2}
            centeredSlides={true}
            className="py-4"
          >
            {benefits.map((benefit, index) => (
              <SwiperSlide key={benefit.title}>
                <motion.div
                  className="relative bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-gray-100"
                >
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${benefit.bgColor} ${benefit.color} flex items-center justify-center`}>
                      {benefit.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-base font-bold mb-1 ${benefit.color}`}>
                        {benefit.title}
                      </h3>
                      <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>

        {/* Benefits Grid - Desktop only */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="hidden lg:grid grid-cols-4 gap-6"
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              variants={itemVariants}
              onHoverStart={() => setHoveredIndex(index)}
              onHoverEnd={() => setHoveredIndex(null)}
              className="group relative"
            >
              <motion.div
                animate={{
                  boxShadow: hoveredIndex === index
                    ? '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
                    : '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
                className={`relative bg-white/80 backdrop-blur-sm rounded-3xl p-7 border border-gray-100 h-full overflow-hidden transition-all duration-500 ${
                  hoveredIndex === index ? `${benefit.borderColor} border-2` : ''
                }`}
              >
                {/* Gradient Overlay */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute inset-0 bg-gradient-to-br ${benefit.hoverGradient} to-transparent pointer-events-none`}
                />

                {/* Glow Effect */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: hoveredIndex === index ? 1 : 0, scale: hoveredIndex === index ? 1 : 0.5 }}
                  transition={{ duration: 0.4 }}
                  className={`absolute -top-10 -right-10 w-32 h-32 ${benefit.bgColor} rounded-full blur-2xl`}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <motion.div
                    variants={iconFloatVariants}
                    initial="rest"
                    animate={hoveredIndex === index ? 'hover' : 'rest'}
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${benefit.bgColor} ${benefit.color} mb-5 shadow-lg transition-shadow duration-300 ${
                      hoveredIndex === index ? 'shadow-xl' : ''
                    }`}
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={hoveredIndex === index ? 'active' : 'default'}
                        initial={{ scale: 0, rotate: -180, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        exit={{ scale: 0, rotate: 180, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {hoveredIndex === index ? benefit.activeIcon : benefit.icon}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>

                  {/* Title */}
                  <h3 className={`text-lg font-bold mb-3 transition-colors duration-300 ${
                    hoveredIndex === index ? benefit.color : 'text-gray-900'
                  }`}>
                    {benefit.title}
                  </h3>

                  {/* Description */}
                  <p className="text-gray-500 text-sm leading-relaxed mb-5">
                    {benefit.description}
                  </p>

                  {/* Stats */}
                  {benefit.stats && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: hoveredIndex === index ? 1 : 0.7, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex items-baseline gap-1 ${benefit.color}`}
                    >
                      <span className="text-3xl font-black">
                        <AnimatedCounter value={benefit.stats.value} suffix={benefit.stats.suffix} />
                      </span>
                      <span className="text-xs font-medium opacity-80 ml-1">
                        {benefit.stats.label}
                      </span>
                    </motion.div>
                  )}

                  {/* Bottom Accent Line */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: hoveredIndex === index ? 1 : 0 }}
                    transition={{ duration: 0.4 }}
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${benefit.hoverGradient.replace('/10', '/20')} to-transparent origin-left rounded-b-3xl`}
                  />
                </div>

                {/* Corner Decoration */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: hoveredIndex === index ? 1 : 0 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute -bottom-1 -right-1 w-20 h-20 ${benefit.bgColor} rounded-tl-[40px]`}
                />

                {/* Step Number */}
                <div className={`absolute top-4 right-4 text-5xl font-black ${benefit.color} opacity-5 select-none`}>
                  0{index + 1}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Trust Badges - Smaller on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mt-8 lg:mt-16"
        >
          {[
            { icon: <Icon.PiLock size={14} />, text: 'Secure' },
            { icon: <Icon.PiCreditCard size={14} />, text: 'Easy Pay' },
            { icon: <Icon.PiThermometer size={14} />, text: 'Temp Safe' },
            { icon: <Icon.PiCalendarCheck size={14} />, text: '24/7' }
          ].map((badge, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.05 }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 bg-white rounded-full shadow-sm border border-gray-100 text-[10px] md:text-sm text-gray-600"
            >
              <span className="text-emerald-500">{badge.icon}</span>
              {badge.text}
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA - Simplified for mobile */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8 lg:mt-14"
        >
          <motion.a
            href="/shop"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-2 px-6 py-2.5 md:px-10 md:py-4 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white font-bold rounded-full shadow-lg hover:shadow-2xl transition-all cursor-pointer text-sm md:text-base"
          >
            <Icon.PiShoppingBag size={18} className="md:text-xl" />
            <span className="relative z-10">Shop Now</span>
            <Icon.PiArrowRight size={16} className="md:text-xl" />
          </motion.a>
          
          <p className="text-gray-400 text-xs md:text-sm mt-3 lg:mt-4">
            Free delivery on orders over ₦15,000
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default Benefit;
