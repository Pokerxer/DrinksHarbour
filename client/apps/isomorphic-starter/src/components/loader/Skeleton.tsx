'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  rounded = 'md',
}) => {
  const roundedClasses = {
    sm: 'rounded-sm',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  };

  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={`bg-gray-200 ${roundedClasses[rounded]} ${className}`}
    />
  );
};

interface ProductCardSkeletonProps {
  count?: number;
  layout?: 'grid' | 'list';
}

export const ProductCardSkeleton: React.FC<ProductCardSkeletonProps> = ({
  count = 1,
  layout = 'grid',
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          className={layout === 'grid' ? 'space-y-3' : 'flex gap-4'}
        >
          {/* Image skeleton */}
          <Skeleton
            className={layout === 'grid' ? 'aspect-square w-full' : 'w-24 h-24 flex-shrink-0'}
            rounded="lg"
          />

          {layout === 'list' && (
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-5 w-1/4" />
            </div>
          )}

          {layout === 'grid' && (
            <div className="space-y-2 px-1">
              <Skeleton className="h-3 w-1/2" rounded="sm" />
              <Skeleton className="h-4 w-3/4" rounded="sm" />
              <Skeleton className="h-3 w-1/3" rounded="sm" />
              <div className="flex justify-between items-center pt-2">
                <Skeleton className="h-5 w-1/3" rounded="sm" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </>
  );
};

interface TextSkeletonProps {
  lines?: number;
  className?: string;
}

export const TextSkeleton: React.FC<TextSkeletonProps> = ({
  lines = 3,
  className = '',
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-4"
          rounded="sm"
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  );
};

interface PageSkeletonProps {
  type?: 'shop' | 'product' | 'profile';
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({ type = 'shop' }) => {
  if (type === 'shop') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="container mx-auto">
          {/* Header skeleton */}
          <div className="flex justify-between items-center mb-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>

          {/* Filter skeleton */}
          <div className="flex gap-2 mb-6 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-24 flex-shrink-0" rounded="full" />
            ))}
          </div>

          {/* Grid skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <ProductCardSkeleton count={8} layout="grid" />
          </div>
        </div>
      </div>
    );
  }

  if (type === 'product') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Image skeleton */}
            <Skeleton className="aspect-square rounded-2xl" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-1/3" />
              <Skeleton className="h-24 w-full" />
              <div className="flex gap-4 pt-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-12 w-12 rounded-lg" />
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-2xl">
        <div className="bg-white rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" rounded="lg" />
            <Skeleton className="h-12 w-full" rounded="lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

interface DotsLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

export const DotsLoader: React.FC<DotsLoaderProps> = ({
  size = 'md',
  color = 'bg-emerald-500',
}) => {
  const sizeMap = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  return (
    <div className="flex items-center justify-center gap-1.5">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          animate={{ y: [0, -8, 0] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
          className={`${sizeMap[size]} ${color} rounded-full`}
        />
      ))}
    </div>
  );
};

interface PulseLoaderProps {
  size?: 'sm' | 'md' | 'lg';
}

export const PulseLoader: React.FC<PulseLoaderProps> = ({ size = 'md' }) => {
  const sizeMap = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
  };

  return (
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={`${sizeMap[size]} rounded-full bg-gradient-to-r from-emerald-400 to-teal-500`}
    />
  );
};

interface BottleLoaderProps {
  className?: string;
}

export const BottleLoader: React.FC<BottleLoaderProps> = ({ className = '' }) => {
  return (
    <motion.div
      animate={{ rotate: [-5, 5, -5], y: [0, -5, 0] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative ${className}`}
    >
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="text-5xl"
      >
        🍾
      </motion.div>
      <motion.div
        animate={{ scaleX: [0.8, 1, 0.8] }}
        transition={{ duration: 0.8, repeat: Infinity }}
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-1 bg-emerald-400 rounded-full"
      />
    </motion.div>
  );
};

interface InlineLoaderProps {
  text?: string;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({ text = 'Loading' }) => {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.1,
            }}
            className="text-emerald-500 font-bold"
          >
            .
          </motion.span>
        ))}
      </div>
      <span className="text-gray-500 text-sm">{text}</span>
    </div>
  );
};
