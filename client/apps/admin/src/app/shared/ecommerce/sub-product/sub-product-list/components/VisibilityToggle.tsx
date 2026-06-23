// @ts-nocheck
'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Text, Badge, Flex } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiEyeBold,
  PiEyeSlashBold,
  PiGlobeBold,
  PiLockBold,
  PiCaretDownBold,
  PiCheckBold,
  PiXBold,
  PiStarBold,
  PiTrendUpBold,
  PiSparkle,
} from 'react-icons/pi';

interface VisibilityToggleProps {
  currentVisibility: 'all' | 'published' | 'draft' | 'hidden';
  onVisibilityChange: (visibility: 'all' | 'published' | 'draft' | 'hidden') => void;
  counts?: {
    published: number;
    draft: number;
    hidden: number;
  };
}

interface QuickActionsProps {
  selectedCount: number;
  onPublish: () => void;
  onUnpublish: () => void;
  onFeature: () => void;
  onUnfeature: () => void;
}

const VISIBILITY_OPTIONS = [
  { 
    id: 'all', 
    label: 'All Products', 
    icon: PiGlobeBold, 
    color: 'blue',
    description: 'Show all products',
  },
  { 
    id: 'published', 
    label: 'Published', 
    icon: PiEyeBold, 
    color: 'green',
    description: 'Live on store',
  },
  { 
    id: 'draft', 
    label: 'Draft', 
    icon: PiEyeSlashBold, 
    color: 'gray',
    description: 'Not visible to customers',
  },
  { 
    id: 'hidden', 
    label: 'Hidden', 
    icon: PiLockBold, 
    color: 'red',
    description: 'Manually hidden',
  },
];

export default function VisibilityToggle({
  currentVisibility,
  onVisibilityChange,
  counts = { published: 0, draft: 0, hidden: 0 },
}: VisibilityToggleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);
  
  const currentOption = VISIBILITY_OPTIONS.find(opt => opt.id === currentVisibility) || VISIBILITY_OPTIONS[0];
  const Icon = currentOption.icon;
  
  const getCount = (id: string) => {
    if (id === 'all') return counts.published + counts.draft + counts.hidden;
    return counts[id as keyof typeof counts] || 0;
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border-2',
          'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
        )}
      >
        <Icon className="w-4 h-4 text-gray-500" />
        <span>{currentOption.label}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <PiCaretDownBold className="w-4 h-4 text-gray-400" />
        </motion.div>
      </motion.button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
          >
            <div className="p-2">
              {VISIBILITY_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                const isSelected = currentVisibility === option.id;
                const count = getCount(option.id);
                
                return (
                  <motion.button
                    key={option.id}
                    whileHover={{ x: 3, backgroundColor: 'rgb(249, 250, 251)' }}
                    onClick={() => {
                      onVisibilityChange(option.id as any);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all',
                      isSelected && 'bg-blue-50'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      isSelected ? 'bg-blue-100' : 'bg-gray-100'
                    )}>
                      <OptionIcon className={cn(
                        'w-4 h-4',
                        isSelected ? 'text-blue-600' : 'text-gray-500'
                      )} />
                    </div>
                    
                    <div className="flex-1">
                      <Text className={cn(
                        'text-sm font-semibold',
                        isSelected ? 'text-blue-700' : 'text-gray-700'
                      )}>
                        {option.label}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {option.description}
                      </Text>
                    </div>
                    
                    <Badge 
                      size="sm" 
                      variant="flat"
                      color={isSelected ? 'primary' : 'secondary'}
                    >
                      {count}
                    </Badge>
                    
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                      >
                        <PiCheckBold className="w-4 h-4 text-blue-600" />
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Quick Actions for selected items
export function QuickActions({
  selectedCount,
  onPublish,
  onUnpublish,
  onFeature,
  onUnfeature,
}: QuickActionsProps) {
  if (selectedCount === 0) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-xl border border-blue-200"
    >
      <Text className="text-sm font-medium text-blue-700">
        {selectedCount} selected:
      </Text>
      
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onPublish}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-semibold hover:bg-green-600 transition-colors"
      >
        <PiEyeBold className="w-3.5 h-3.5" />
        Publish
      </motion.button>
      
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onUnpublish}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-semibold hover:bg-gray-600 transition-colors"
      >
        <PiEyeSlashBold className="w-3.5 h-3.5" />
        Unpublish
      </motion.button>
      
      <div className="w-px h-5 bg-blue-200 mx-1" />
      
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onFeature}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors"
      >
        <PiStarBold className="w-3.5 h-3.5" />
        Feature
      </motion.button>
    </motion.div>
  );
}

// Inline visibility toggle for individual rows
export function InlineVisibilityToggle({
  isPublished,
  onToggle,
  isLoading = false,
}: {
  isPublished: boolean;
  onToggle: () => void;
  isLoading?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      disabled={isLoading}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
        isPublished
          ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
          : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100',
        isLoading && 'opacity-50 cursor-not-allowed'
      )}
    >
      {isPublished ? (
        <>
          <PiEyeBold className="w-3.5 h-3.5" />
          Live
        </>
      ) : (
        <>
          <PiEyeSlashBold className="w-3.5 h-3.5" />
          Draft
        </>
      )}
    </motion.button>
  );
}
