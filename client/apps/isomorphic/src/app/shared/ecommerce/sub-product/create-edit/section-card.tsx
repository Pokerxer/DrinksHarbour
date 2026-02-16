// @ts-nocheck
'use client';

import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Text } from 'rizzui';
import { PiCaretDown, PiCaretUp, PiCheck } from 'react-icons/pi';
import cn from '@core/utils/class-names';

interface SectionCardProps {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'cyan' | 'yellow' | 'pink' | 'rose' | 'indigo' | 'gray';
  isExpanded: boolean;
  isActive?: boolean;
  onToggle: () => void;
  stepNumber?: number;
  children: ReactNode;
  isCompleted?: boolean;
}

const colorClasses = {
  blue: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-600',
    ring: 'ring-blue-500',
  },
  green: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-600',
    ring: 'ring-green-500',
  },
  orange: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-600',
    ring: 'ring-orange-500',
  },
  purple: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-600',
    ring: 'ring-purple-500',
  },
  cyan: {
    bg: 'bg-cyan-50',
    border: 'border-cyan-200',
    text: 'text-cyan-600',
    ring: 'ring-cyan-500',
  },
  yellow: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-600',
    ring: 'ring-yellow-500',
  },
  pink: {
    bg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-600',
    ring: 'ring-pink-500',
  },
  rose: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-600',
    ring: 'ring-rose-500',
  },
  indigo: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-600',
    ring: 'ring-indigo-500',
  },
  gray: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-600',
    ring: 'ring-gray-500',
  },
};

const toggleVariants = {
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: {
        duration: 0.3,
        ease: [0.04, 0.62, 0.23, 0.98],
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: {
        duration: 0.3,
        ease: [0.04, 0.62, 0.23, 0.98],
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
};

export default function SectionCard({
  id,
  title,
  description,
  icon: Icon,
  color = 'blue',
  isExpanded,
  isActive,
  onToggle,
  stepNumber,
  children,
  isCompleted,
}: SectionCardProps) {
  const colors = colorClasses[color];

  return (
    <motion.div
      layout
      className={cn(
        'overflow-hidden rounded-2xl border transition-all duration-300',
        isActive
          ? `${colors.border} shadow-md ring-1 ${colors.ring}`
          : 'border-gray-100 bg-white shadow-sm hover:shadow-md',
        !isExpanded && 'opacity-75'
      )}
    >
      <motion.div layout className="relative">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center justify-between px-5 py-4 text-left transition-colors',
            isActive ? `${colors.bg}` : 'hover:bg-gray-50'
          )}
        >
          <div className="flex items-center gap-4">
            {stepNumber && (
              <motion.div
                initial={false}
                animate={{
                  scale: isActive ? 1.1 : 1,
                  backgroundColor: isActive
                    ? '#2563eb'
                    : isCompleted
                    ? '#22c55e'
                    : '#f3f4f6',
                }}
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors',
                  isActive
                    ? 'text-white'
                    : isCompleted
                    ? 'text-white'
                    : 'text-gray-600'
                )}
              >
                {isCompleted ? (
                  <PiCheck className="h-5 w-5" />
                ) : (
                  stepNumber
                )}
              </motion.div>
            )}
            
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              colors.bg,
              colors.text
            )}>
              <Icon className="h-5 w-5" />
            </div>

            <div>
              <Text className="font-semibold text-gray-900">
                {title}
              </Text>
              <Text className="text-sm text-gray-500">
                {description}
              </Text>
            </div>
          </div>

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500"
          >
            <PiCaretDown className="h-4 w-4" />
          </motion.div>
        </button>
      </motion.div>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={toggleVariants}
          >
            <div className={cn(
              'border-t px-5 py-5',
              colors.border,
              isActive ? colors.bg : 'border-gray-100'
            )}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
