'use client';

import React from 'react';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface BenefitItem {
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}

const benefits: BenefitItem[] = [
  {
    icon: <Icon.PiShieldCheck size={40} />,
    activeIcon: <Icon.PiShieldCheckFill size={40} />,
    title: 'Authentic Products',
    description: 'All products are verified and sourced directly from authorized manufacturers',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50'
  },
  {
    icon: <Icon.PiTruck size={40} />,
    activeIcon: <Icon.PiTruckFill size={40} />,
    title: 'Fast Delivery',
    description: 'Free delivery on orders over ₦10,000 with real-time tracking',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  {
    icon: <Icon.PiRecycle size={40} />,
    activeIcon: <Icon.PiRecycleFill size={40} />,
    title: 'Eco-Friendly',
    description: 'Sustainable packaging made from recyclable and biodegradable materials',
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    icon: <Icon.PiHeadset size={40} />,
    activeIcon: <Icon.PiHeadsetFill size={40} />,
    title: '24/7 Support',
    description: 'Expert customer service team available round the clock for assistance',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  }
];

interface BenefitProps {
  className?: string;
}

const Benefit: React.FC<BenefitProps> = ({ className = '' }) => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 40,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
        damping: 15,
        duration: 0.6
      }
    }
  };

  const iconVariants = {
    rest: { 
      scale: 1, 
      rotate: 0,
      y: 0
    },
    hover: { 
      scale: 1.15, 
      rotate: [0, -10, 10, 0],
      y: -5,
      transition: {
        rotate: {
          duration: 0.5,
          ease: 'easeInOut'
        },
        scale: {
          type: 'spring',
          stiffness: 300,
          damping: 15
        }
      }
    }
  };

  const gradientVariants = {
    rest: {
      opacity: 0,
      scale: 0.8
    },
    hover: {
      opacity: 1,
      scale: 1.2,
      transition: {
        duration: 0.4
      }
    }
  };

  return (
    <section className={`py-16 md:py-24 relative overflow-hidden ${className}`}>
      {/* Background Decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-gray-50 pointer-events-none" />
      
      {/* Floating Orbs */}
      <motion.div
        animate={{ 
          y: [0, -20, 0],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ 
          duration: 5, 
          repeat: Infinity,
          ease: 'easeInOut'
        }}
        className="absolute top-20 left-10 w-64 h-64 bg-emerald-200/30 rounded-full blur-3xl"
      />
      <motion.div
        animate={{ 
          y: [0, 20, 0],
          opacity: [0.3, 0.5, 0.3]
        }}
        transition={{ 
          duration: 6, 
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1
        }}
        className="absolute bottom-20 right-10 w-72 h-72 bg-blue-200/30 rounded-full blur-3xl"
      />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium mb-4"
          >
            <Icon.PiCrown size={16} className="text-amber-500" />
            Why Choose Us
          </motion.span>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
          >
            Benefits of Shopping
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-blue-600 mt-2">
              With DrinkHarbour
            </span>
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="text-gray-500 text-lg max-w-2xl mx-auto"
          >
            Experience premium service and quality with every order
          </motion.p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8"
        >
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              variants={itemVariants}
              whileHover="hover"
              initial="rest"
              animate="rest"
              className="group relative"
            >
              <motion.div
                className="relative bg-white rounded-3xl p-8 shadow-sm border border-gray-100 h-full overflow-hidden transition-shadow duration-300 group-hover:shadow-xl"
              >
                {/* Hover Gradient Background */}
                <motion.div
                  variants={gradientVariants}
                  className={`absolute inset-0 ${benefit.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                {/* Content */}
                <div className="relative z-10">
                  {/* Icon Container */}
                  <motion.div
                    variants={iconVariants}
                    className={`inline-flex items-center justify-center w-20 h-20 rounded-2xl ${benefit.bgColor} ${benefit.color} mb-6 transition-all duration-300 group-hover:scale-110 group-hover:shadow-lg`}
                  >
                    <motion.div
                      className="group-hover:hidden"
                    >
                      {benefit.icon}
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, scale: 0 }}
                      className="hidden group-hover:block"
                    >
                      {benefit.activeIcon}
                    </motion.div>
                  </motion.div>

                  {/* Step Number */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className={`absolute top-6 right-6 text-6xl font-black ${benefit.color} opacity-10 group-hover:opacity-20 transition-opacity duration-300`}
                  >
                    0{index + 1}
                  </motion.div>

                  {/* Title */}
                  <motion.h3
                    className="text-lg font-bold text-gray-900 mb-3 uppercase tracking-wide group-hover:text-gray-800 transition-colors"
                  >
                    {benefit.title}
                  </motion.h3>

                  {/* Description */}
                  <motion.p
                    className="text-gray-500 text-sm leading-relaxed group-hover:text-gray-600 transition-colors"
                  >
                    {benefit.description}
                  </motion.p>

                  {/* Animated Line */}
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: '40%' }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.6 }}
                    className={`h-1 ${benefit.bgColor.replace('bg-', 'bg-').replace('50', '500')} rounded-full mt-6 group-hover:w-full transition-all duration-500`}
                  />
                </div>

                {/* Corner Decoration */}
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  whileHover={{ opacity: 1, scale: 1 }}
                  className={`absolute -bottom-2 -right-2 w-16 h-16 ${benefit.bgColor} rounded-tl-3xl opacity-0 group-hover:opacity-100 transition-all duration-300`}
                />
              </motion.div>
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-16"
        >
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
          >
            <Icon.PiShoppingBag size={20} />
            Start Shopping Now
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            >
              <Icon.PiArrowRight size={18} />
            </motion.span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default Benefit;
