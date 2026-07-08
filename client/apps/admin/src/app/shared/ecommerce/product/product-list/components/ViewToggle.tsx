// @ts-nocheck
'use client';

import { motion } from 'framer-motion';
import { Flex } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiGridFourBold, PiSquaresFourBold, PiRowsBold } from 'react-icons/pi';

export type ViewMode = 'list' | 'grid' | 'compact';

interface ViewToggleProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  showLabels?: boolean;
}

const VIEW_OPTIONS: {
  id: ViewMode;
  label: string;
  icon: React.ElementType;
  description: string;
}[] = [
  {
    id: 'list',
    label: 'List',
    icon: PiRowsBold,
    description: 'Detailed table view',
  },
  {
    id: 'grid',
    label: 'Grid',
    icon: PiGridFourBold,
    description: 'Card grid layout',
  },
  {
    id: 'compact',
    label: 'Compact',
    icon: PiSquaresFourBold,
    description: 'Small cards',
  },
];

export default function ViewToggle({
  currentView,
  onViewChange,
  showLabels = false,
}: ViewToggleProps) {
  return (
    <div className="flex items-center rounded-xl bg-gray-100 p-1">
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
              'relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all',
              isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {isActive && (
              <motion.div
                layoutId="activeProductViewBg"
                className="absolute inset-0 rounded-lg bg-white shadow-sm"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Icon className="h-4 w-4" />
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
    <Flex gap="1" className="rounded-lg bg-gray-100 p-1">
      {VIEW_OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <motion.button
            key={option.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => onViewChange(option.id)}
            className={cn(
              'rounded-md p-2 transition-all',
              currentView === option.id
                ? 'bg-white text-[#b20202] shadow-sm'
                : 'text-gray-400 hover:text-gray-600'
            )}
            title={`${option.label} View`}
          >
            <Icon className="h-4 w-4" />
          </motion.button>
        );
      })}
    </Flex>
  );
}

// Dropdown variant for mobile
export function ViewToggleDropdown({
  currentView,
  onViewChange,
}: Omit<ViewToggleProps, 'showLabels'>) {
  const currentOption =
    VIEW_OPTIONS.find((o) => o.id === currentView) || VIEW_OPTIONS[0];
  const Icon = currentOption.icon;

  return (
    <div className="group relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300"
      >
        <Icon className="h-4 w-4" />
        <span>{currentOption.label}</span>
      </motion.button>

      <div className="invisible absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-xl border border-gray-200 bg-white py-1 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
        {VIEW_OPTIONS.map((option) => {
          const OptionIcon = option.icon;
          const isActive = currentView === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onViewChange(option.id)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-red-50 text-[#b20202]'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <OptionIcon className="h-4 w-4" />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
