'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiWine,
  PiWineFill,
  PiTruck,
  PiTruckFill,
  PiShieldCheck,
  PiShieldCheckFill,
  PiMedal,
  PiMedalFill,
  PiShoppingBag,
  PiArrowRight,
  PiLock,
  PiCreditCard,
  PiThermometer,
  PiCalendarCheck,
} from 'react-icons/pi';

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

// ─── Counter ──────────────────────────────────────────────────────────────────

const AnimatedCounter = memo(function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
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
            if (document.hidden) return;
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
});

// ─── Data ─────────────────────────────────────────────────────────────────────

const benefits: BenefitItem[] = [
  {
    icon: <PiWine size={36} />,
    activeIcon: <PiWineFill size={36} />,
    title: 'Premium Selection',
    description: 'Curated collection of fine wines, craft beers, and premium spirits from world-renowned producers',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    hoverGradient: 'from-red-500/10',
    stats: { value: 500, suffix: '+', label: 'Premium Brands' }
  },
  {
    icon: <PiTruck size={36} />,
    activeIcon: <PiTruckFill size={36} />,
    title: 'Express Delivery',
    description: 'Lightning-fast delivery across Nigeria with temperature-controlled packaging for perfect quality',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    hoverGradient: 'from-blue-500/10',
    stats: { value: 30, suffix: 'min', label: 'Avg. Delivery' }
  },
  {
    icon: <PiShieldCheck size={36} />,
    activeIcon: <PiShieldCheckFill size={36} />,
    title: 'Age Verified',
    description: 'Secure age verification system ensuring all deliveries comply with regulations',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    hoverGradient: 'from-emerald-500/10',
    stats: { value: 100, suffix: '%', label: 'Compliant' }
  },
  {
    icon: <PiMedal size={36} />,
    activeIcon: <PiMedalFill size={36} />,
    title: 'Quality Guaranteed',
    description: 'Every bottle inspected and authenticated. Money-back guarantee on all purchases',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    hoverGradient: 'from-amber-500/10',
    stats: { value: 50, suffix: 'K+', label: 'Happy Customers' }
  }
];

// ─── Benefit ──────────────────────────────────────────────────────────────────

const Benefit: React.FC<BenefitProps> = ({ className = '' }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <section className={`py-8 md:py-12 lg:py-20 relative overflow-hidden ${className}`}>
      {/* Dynamic Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-red-50/30" />

      {/* Decorative blobs — pure CSS, no JS animation */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-gradient-to-br from-red-200/40 to-transparent rounded-full blur-3xl motion-safe:animate-[blobFloat_8s_ease-in-out_infinite]" />
      <div className="absolute -bottom-10 -right-10 w-80 h-80 bg-gradient-to-tl from-emerald-200/30 to-transparent rounded-full blur-3xl motion-safe:animate-[blobFloat_10s_ease-in-out_infinite_2s]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-amber-100/20 to-transparent rounded-full blur-3xl motion-safe:animate-[blobPulse_7s_ease-in-out_infinite_4s]" />

      {/* Floating particles — pure CSS */}
      {[...Array(6)].map((_, i) => (
        <div
          key={i}
          className={`particle absolute w-2 h-2 rounded-full ${
            i % 3 === 0 ? 'bg-red-400/50' : i % 3 === 1 ? 'bg-emerald-400/50' : 'bg-amber-400/50'
          }`}
          style={{
            left: `${15 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
            '--duration': `${3 + i * 0.5}s`,
            '--delay': `${i * 0.3}s`
          } as React.CSSProperties}
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
          <h2
            className="text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 mb-3 lg:mb-6"
          >
            Why Choose Us
          </h2>

          <p className="text-gray-500 text-sm md:text-base lg:text-lg max-w-2xl mx-auto">
            Premium quality with{' '}
            <span className="text-red-600 font-semibold">fast delivery</span> 
            {' '}and{' '}
            <span className="text-emerald-600 font-semibold">guaranteed authenticity</span>
          </p>
        </motion.div>

        {/* Mobile: horizontal scroll (CSS only, no Swiper) */}
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-4 lg:hidden -mx-4 px-4">
          {benefits.map((benefit) => (
            <div
              key={benefit.title}
              className="snap-start shrink-0 w-[80vw] max-w-[320px]"
            >
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-gray-100 h-full">
                <div className="flex items-start gap-4">
                  <div className={`shrink-0 w-12 h-12 rounded-xl ${benefit.bgColor} ${benefit.color} flex items-center justify-center`}>
                    {benefit.icon}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`text-base font-bold mb-1 ${benefit.color}`}>
                      {benefit.title}
                    </h3>
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: grid */}
        <div className="hidden lg:grid grid-cols-4 gap-6">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="group relative"
            >
              <div
                className={`relative bg-white/80 backdrop-blur-sm rounded-3xl p-7 border h-full overflow-hidden transition-all duration-500 ${
                  hoveredIndex === index
                    ? `${benefit.borderColor} border-2 shadow-2xl`
                    : 'border-gray-100 shadow-sm'
                }`}
              >
                {/* Gradient Overlay */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${benefit.hoverGradient} to-transparent pointer-events-none transition-opacity duration-300 ${
                    hoveredIndex === index ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Glow Effect */}
                <div
                  className={`absolute -top-10 -right-10 w-32 h-32 ${benefit.bgColor} rounded-full blur-2xl transition-all duration-400 ${
                    hoveredIndex === index ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                  }`}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon */}
                  <div
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl ${benefit.bgColor} ${benefit.color} mb-5 transition-all duration-300 ${
                      hoveredIndex === index ? 'shadow-xl motion-safe:animate-[iconFloat_0.6s_ease-in-out_infinite]' : 'shadow-lg'
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
                  </div>

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
                    <div className={`flex items-baseline gap-1 transition-opacity duration-300 ${benefit.color} ${
                      hoveredIndex === index ? 'opacity-100' : 'opacity-70'
                    }`}>
                      <span className="text-3xl font-black">
                        <AnimatedCounter value={benefit.stats.value} suffix={benefit.stats.suffix} />
                      </span>
                      <span className="text-xs font-medium opacity-80 ml-1">
                        {benefit.stats.label}
                      </span>
                    </div>
                  )}

                  {/* Bottom Accent Line */}
                  <div
                    className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${benefit.hoverGradient.replace('/10', '/20')} to-transparent origin-left rounded-b-3xl transition-transform duration-400 ${
                      hoveredIndex === index ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </div>

                {/* Corner Decoration */}
                <div
                  className={`absolute -bottom-1 -right-1 w-20 h-20 ${benefit.bgColor} rounded-tl-[40px] transition-opacity duration-300 ${
                    hoveredIndex === index ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Step Number */}
                <div className={`absolute top-4 right-4 text-5xl font-black ${benefit.color} opacity-5 select-none`}>
                  0{index + 1}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2 md:gap-4 mt-8 lg:mt-16">
          {[
            { icon: <PiLock size={14} />, text: 'Secure' },
            { icon: <PiCreditCard size={14} />, text: 'Easy Pay' },
            { icon: <PiThermometer size={14} />, text: 'Temp Safe' },
            { icon: <PiCalendarCheck size={14} />, text: '24/7' }
          ].map((badge, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1.5 md:px-4 md:py-2 bg-white rounded-full shadow-sm border border-gray-100 text-[10px] md:text-sm text-gray-600 motion-safe:hover:scale-105 transition-transform"
            >
              <span className="text-emerald-500">{badge.icon}</span>
              {badge.text}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-8 lg:mt-14">
          <a
            href="/shop"
            className="inline-flex items-center gap-2 px-6 py-2.5 md:px-10 md:py-4 bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white font-bold rounded-full shadow-lg hover:shadow-2xl transition-all cursor-pointer text-sm md:text-base motion-safe:hover:scale-[1.03] motion-safe:active:scale-[0.97]"
          >
            <PiShoppingBag size={18} className="md:text-xl" />
            <span>Shop Now</span>
            <PiArrowRight size={16} className="md:text-xl" />
          </a>

          <p className="text-gray-400 text-xs md:text-sm mt-3 lg:mt-4">
            Free delivery on orders over ₦2,000,000
          </p>
        </div>
      </div>
    </section>
  );
};

export default Benefit;
