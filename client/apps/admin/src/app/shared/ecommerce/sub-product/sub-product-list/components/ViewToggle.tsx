// @ts-nocheck
'use client';

import { motion } from 'framer-motion';
import { Text, Flex } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiListBold,
  PiGridFourBold,
  PiSquaresFourBold,
  PiRowsBold,
} from 'react-icons/pi';

export type ViewMode = 'list' | 'grid' | 'compact';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  showLabels?: boolean;
}

const VIEW_OPTIONS: { id: ViewMode; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'list', label: 'List', icon: PiRowsBold, description: 'Detailed table view' },
  { id: 'grid', label: 'Grid', icon: PiGridFourBold, description: 'Card grid layout' },
  { id: 'compact', label: 'Compact', icon: PiSquaresFourBold, description: 'Small cards' },
];

export default function ViewToggle({
  currentView,
  onViewChange,
  showLabels = false,
}: ViewToggleProps) {
  return (
    <div className="flex items-center bg-gray-100 rounded-xl p-1">
      {VIEW_OPTIONS.map((option) => {
        const isActive = currentView === option.id;
        const Icon = option.icon;
        
        return (
          <motion.button
            key={option.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onViewChange(option.id)}
            className={cn(
              'relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
              isActive
                ? 'text-gray-900'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeViewBg"
                className="absolute inset-0 bg-white rounded-lg shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="w-4 h-4" />
              {showLabels && <span>{option.label}</span>}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

// Alternative: Icon-only minimal toggle
export function ViewToggleMinimal({
  currentView,
  onViewChange,
}: Omit<ViewToggleProps, 'showLabels'>) {
  return (
    <Flex gap="1" className="bg-gray-100 p-1 rounded-lg">
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onViewChange('list')}
        className={cn(
          'p-2 rounded-md transition-all',
          currentView === 'list'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        )}
        title="List View"
      >
        <PiRowsBold className="w-4 h-4" />
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onViewChange('grid')}
        className={cn(
          'p-2 rounded-md transition-all',
          currentView === 'grid'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        )}
        title="Grid View"
      >
        <PiGridFourBold className="w-4 h-4" />
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => onViewChange('compact')}
        className={cn(
          'p-2 rounded-md transition-all',
          currentView === 'compact'
            ? 'bg-white text-blue-600 shadow-sm'
            : 'text-gray-400 hover:text-gray-600'
        )}
        title="Compact View"
      >
        <PiSquaresFourBold className="w-4 h-4" />
      </motion.button>
    </Flex>
  );
}

// Dropdown variant for mobile
export function ViewToggleDropdown({
  currentView,
  onViewChange,
}: Omit<ViewToggleProps, 'showLabels'>) {
  const currentOption = VIEW_OPTIONS.find(o => o.id === currentView) || VIEW_OPTIONS[0];
  const Icon = currentOption.icon;

  return (
    <div className="relative group">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-gray-300"
      >
        <Icon className="w-4 h-4" />
        <span>{currentOption.label}</span>
      </motion.button>
      
      <div className="absolute top-full right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[140px]">
        {VIEW_OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          const isActive = currentView === option.id;
          
          return (
            <button
              key={option.id}
              onClick={() => onViewChange(option.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <OptionIcon className="w-4 h-4" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
