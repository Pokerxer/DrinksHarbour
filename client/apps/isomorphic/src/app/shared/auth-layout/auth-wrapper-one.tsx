'use client';

import Link from 'next/link';
import logoImg from '@public/logo-primary.svg';
import logoImgText from '@public/logo-primary-text.svg';
import Image from 'next/image';
import { Title, Text } from 'rizzui';
import { PiArrowLeftBold, PiShieldCheck, PiSparkle } from 'react-icons/pi';
import { motion } from 'framer-motion';

interface AuthWrapperOneProps {
  children: React.ReactNode;
  title: React.ReactNode;
  bannerTitle?: string;
  bannerDescription?: string;
  description?: string;
  pageImage?: React.ReactNode;
  isSocialLoginActive?: boolean;
  isSignIn?: boolean;
}

// Animation variants
const pageVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      staggerChildren: 0.1,
    },
  },
};

const leftPanelVariants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
    },
  },
};

const rightPanelVariants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: 'spring',
      stiffness: 100,
      damping: 20,
      delay: 0.2,
    },
  },
};

const floatAnimation = {
  y: [0, -10, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

const pulseAnimation = {
  scale: [1, 1.05, 1],
  opacity: [0.5, 0.8, 0.5],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: 'easeInOut',
  },
};

export default function AuthWrapperOne({
  children,
  title,
  bannerTitle,
  bannerDescription,
  description,
  pageImage,
  isSocialLoginActive = false,
  isSignIn = false,
}: AuthWrapperOneProps) {
  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen"
    >
      {/* Mobile Back Button */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        <Link
          href={'/'}
          className="sticky start-0 top-0 z-20 flex items-center justify-center bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 p-3.5 text-sm font-medium text-white md:p-4 lg:hidden shadow-lg"
        >
          <motion.div
            animate={{ x: [0, -4, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <PiArrowLeftBold />
          </motion.div>
          <Text className="ms-1 font-lexend">Back to home</Text>
        </Link>
      </motion.div>

      <div className="min-h-screen justify-between gap-x-8 px-4 py-8 pt-10 md:pt-12 lg:flex lg:p-6 xl:gap-x-10 xl:p-7 2xl:p-10 2xl:pt-10 [&>div]:min-h-[calc(100vh-80px)]">
        {/* Left Side - Form */}
        <motion.div 
          className="relative flex w-full items-center justify-center lg:w-5/12 2xl:justify-end 2xl:pe-24"
          variants={leftPanelVariants}
        >
          {/* Decorative elements */}
          <motion.div
            className="absolute -top-10 -left-10 w-40 h-40 bg-blue-200/30 rounded-full blur-3xl"
            animate={pulseAnimation}
          />
          <motion.div
            className="absolute bottom-20 -right-10 w-32 h-32 bg-indigo-200/30 rounded-full blur-3xl"
            animate={{
              ...pulseAnimation,
              transition: { ...pulseAnimation.transition, delay: 1.5 }
            }}
          />

          <div className="w-full max-w-sm md:max-w-md lg:py-7 lg:ps-3 lg:pt-16 2xl:w-[630px] 2xl:max-w-none 2xl:ps-20 2xl:pt-7 relative z-10">
            {/* Back Link - Desktop */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Link
                href={'/'}
                className="absolute -top-4 start-0 hidden p-3 text-gray-500 hover:text-gray-700 lg:flex lg:items-center 2xl:-top-7 2xl:ps-20 transition-colors group"
              >
                <motion.div
                  className="group-hover:-translate-x-1 transition-transform"
                  whileHover={{ x: -4 }}
                >
                  <PiArrowLeftBold />
                </motion.div>
                <b className="ms-1 font-medium">Back to home</b>
              </Link>
            </motion.div>

            {/* Logo & Header */}
            <motion.div 
              className="mb-7 px-6 pt-3 text-center md:pt-0 lg:px-0 lg:text-start xl:mb-8 2xl:mb-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 100 }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <Link
                  href={'/'}
                  className="mb-6 inline-flex max-w-[168px] xl:mb-8 hover:opacity-80 transition-opacity"
                >
                  <motion.div
                    initial={{ rotate: -10, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                  >
                    <Image src={logoImg} alt="Drinksharbour" />
                  </motion.div>
                  <Image
                    src={logoImgText}
                    alt="Drinksharbour"
                    className="ps-2.5 dark:invert"
                  />
                </Link>
              </motion.div>

              {/* Admin Badge */}
              <motion.div 
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-full mb-4"
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                whileHover={{ scale: 1.05, y: -2 }}
              >
                <motion.div
                  animate={{ rotate: [0, 15, -15, 0] }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                >
                  <PiShieldCheck className="w-4 h-4 text-blue-600" />
                </motion.div>
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">
                  Admin Portal
                </span>
                <motion.div
                  animate={{ 
                    opacity: [0, 1, 0],
                    scale: [0.5, 1, 0.5]
                  }}
                  transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                >
                  <PiSparkle className="w-3 h-3 text-blue-400" />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Title
                  as="h1"
                  className="mb-5 text-[26px] leading-snug md:text-3xl md:!leading-normal lg:mb-7 lg:pe-16 lg:text-[28px] xl:text-3xl 2xl:pe-8 2xl:text-4xl font-bold"
                >
                  {title}
                </Title>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Text className="leading-[1.85] text-gray-600 md:leading-loose lg:pe-8 2xl:pe-14">
                  {description}
                </Text>
              </motion.div>
            </motion.div>

            {/* Form Container */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ 
                delay: 0.7, 
                type: 'spring', 
                stiffness: 100,
                damping: 20 
              }}
              whileHover={{ 
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
              }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-100/50 relative overflow-hidden"
            >
              {/* Animated border gradient */}
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
                }}
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: 'linear',
                  repeatDelay: 2,
                }}
              />
              
              <div className="relative z-10">
                {children}
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Right Side - Banner */}
        <motion.div 
          className="hidden w-7/12 items-center justify-center rounded-[20px] bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-6 dark:bg-gray-100/40 lg:flex xl:justify-start 2xl:px-16 relative overflow-hidden"
          variants={rightPanelVariants}
        >
          {/* Animated background shapes */}
          <motion.div 
            className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/20 rounded-full blur-3xl"
            animate={{
              x: [0, 50, 0],
              y: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <motion.div 
            className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-200/20 rounded-full blur-3xl"
            animate={{
              x: [0, -30, 0],
              y: [0, -50, 0],
              scale: [1, 1.15, 1],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
          />
          <motion.div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-100/10 rounded-full blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 2,
            }}
          />

          {/* Grid pattern overlay */}
          <div 
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
          
          <div className="pb-8 pt-10 text-center xl:pt-16 2xl:block 2xl:w-[1063px] relative z-10">
            <motion.div 
              className="mx-auto mb-10 max-w-sm pt-2 2xl:max-w-lg"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 100 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 }}
              >
                <Title
                  as="h2"
                  className="mb-5 font-semibold !leading-normal lg:text-[26px] 2xl:px-10 2xl:text-[32px]"
                >
                  {bannerTitle}
                </Title>
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
              >
                <Text className="leading-[1.85] text-gray-600 md:leading-loose 2xl:px-6">
                  {bannerDescription}
                </Text>
              </motion.div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ 
                delay: 1.2, 
                type: 'spring', 
                stiffness: 100,
                damping: 20
              }}
              whileHover={{ 
                scale: 1.02,
                y: -5,
              }}
            >
              {pageImage}
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
