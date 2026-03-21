'use client';

import React from 'react';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface AddToCartButtonProps {
  onClick: () => void;
  onRemove?: () => void;
  isAdding: boolean;
  inCart: boolean;
  cartQuantity?: number;
  variant?: 'default' | 'quick' | 'full';
  colorScheme?: 'emerald' | 'gray' | 'purple' | 'amber' | 'red';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showRemove?: boolean;
}

const AddToCartButton: React.FC<AddToCartButtonProps> = ({
  onClick,
  onRemove,
  isAdding,
  inCart,
  cartQuantity = 0,
  variant = 'default',
  colorScheme = 'emerald',
  size = 'md',
  className = '',
  showRemove = false,
}) => {
  const sizeClasses = {
    sm: 'py-2 px-3 text-xs',
    md: 'py-2.5 px-4 text-sm',
    lg: 'py-3 px-5 text-base',
  };

  const quickSizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-10 h-10',
  };

  const colorSchemes = {
    emerald: {
      adding: 'bg-emerald-500 text-white shadow-emerald-200',
      inCart: 'bg-red-500 text-white hover:bg-red-600',
      inCartAlt: 'bg-emerald-100 text-emerald-700 border-2 border-emerald-300 hover:bg-emerald-50',
      default: 'bg-gradient-to-r from-gray-900 to-gray-800 text-white hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-200',
    },
    gray: {
      adding: 'bg-gray-500 text-white',
      inCart: 'bg-red-500 text-white hover:bg-red-600',
      inCartAlt: 'bg-gray-100 text-gray-700 border-2 border-gray-300',
      default: 'bg-gray-900 text-white hover:bg-gray-800',
    },
    purple: {
      adding: 'bg-purple-500 text-white',
      inCart: 'bg-red-500 text-white hover:bg-red-600',
      inCartAlt: 'bg-purple-100 text-purple-700 border-2 border-purple-300 hover:bg-purple-50',
      default: 'bg-purple-600 text-white hover:bg-purple-700',
    },
    amber: {
      adding: 'bg-amber-500 text-white',
      inCart: 'bg-red-500 text-white hover:bg-red-600',
      inCartAlt: 'bg-amber-100 text-amber-700 border-2 border-amber-300 hover:bg-amber-50',
      default: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700',
    },
    red: {
      adding: 'bg-red-500 text-white',
      inCart: 'bg-red-600 text-white hover:bg-red-700',
      inCartAlt: 'bg-red-100 text-red-700 border-2 border-red-300 hover:bg-red-50',
      default: 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:from-red-600 hover:to-rose-600',
    },
  };

  const scheme = colorSchemes[colorScheme];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (inCart && showRemove && onRemove) {
      onRemove();
    } else {
      onClick();
    }
  };

  if (variant === 'quick') {
    return (
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={handleClick}
        disabled={isAdding}
        className={`rounded-full flex items-center justify-center shadow-lg transition-all ${quickSizeClasses[size]} ${
          isAdding
            ? 'bg-emerald-500 text-white'
            : inCart && showRemove
              ? 'bg-red-500 text-white hover:bg-red-600'
              : inCart
                ? 'bg-emerald-100 text-emerald-600'
                : 'bg-gray-900 text-white hover:bg-gray-800'
        } ${className}`}
      >
        {isAdding ? (
          <Icon.PiSpinner size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} className="animate-spin" />
        ) : inCart && showRemove ? (
          <Icon.PiTrash size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
        ) : inCart ? (
          <Icon.PiCheck size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
        ) : (
          <Icon.PiPlus size={size === 'sm' ? 14 : size === 'md' ? 16 : 18} />
        )}
      </motion.button>
    );
  }

  if (variant === 'full') {
    return (
      <motion.button
        whileHover={isAdding ? undefined : { scale: 1.02 }}
        whileTap={isAdding ? undefined : { scale: 0.98 }}
        onClick={handleClick}
        disabled={isAdding}
        className={`w-full rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
          sizeClasses[size]
        } ${
          isAdding
            ? scheme.adding
            : inCart && showRemove
              ? scheme.inCart
              : inCart
                ? scheme.inCartAlt
                : scheme.default
        } ${className}`}
      >
        {isAdding ? (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1 }}
            >
              <Icon.PiSpinner size={18} />
            </motion.div>
            <span>Adding...</span>
          </>
        ) : inCart && showRemove ? (
          <>
            <Icon.PiTrash size={18} />
            <span>Remove from Cart</span>
          </>
        ) : inCart ? (
          <>
            <Icon.PiShoppingCart size={18} />
            <span>In Cart ({cartQuantity})</span>
          </>
        ) : (
          <>
            <Icon.PiShoppingCart size={18} />
            <span>Add to Cart</span>
          </>
        )}
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={isAdding ? undefined : { scale: 1.02 }}
      whileTap={isAdding ? undefined : { scale: 0.98 }}
      onClick={handleClick}
      disabled={isAdding}
      className={`w-full rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-lg ${
        sizeClasses[size]
      } ${
        isAdding
          ? scheme.adding
          : inCart && showRemove
            ? scheme.inCart
            : inCart
              ? scheme.inCartAlt
              : scheme.default
      } ${className}`}
    >
      {isAdding ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1 }}
        >
          <Icon.PiSpinner size={18} />
        </motion.div>
      ) : inCart && showRemove ? (
        <>
          <Icon.PiTrash size={18} />
          <span>Remove</span>
        </>
      ) : inCart ? (
        <>
          <Icon.PiCheckCircleFill size={18} />
          <span>Add More</span>
        </>
      ) : (
        <>
          <Icon.PiShoppingCart size={18} />
          <span>Add to Cart</span>
        </>
      )}
    </motion.button>
  );
};

export default AddToCartButton;
