'use client';

import { motion } from 'framer-motion';
import { PiMagnifyingGlass, PiPlusCircle } from 'react-icons/pi';

export type SelectionMode = 'search' | 'create';

interface ProductSelectionTabsProps {
  activeMode: SelectionMode;
  onModeChange: (mode: SelectionMode) => void;
  searchCount?: number;
}

export function ProductSelectionTabs({
  activeMode,
  onModeChange,
  searchCount = 0,
}: ProductSelectionTabsProps) {
  const tabs: { mode: SelectionMode; label: string; icon: React.ReactNode; description: string }[] = [
    {
      mode: 'search',
      label: 'Search Existing',
      icon: <PiMagnifyingGlass className="h-4 w-4" />,
      description: 'Find and select a product from the catalog',
    },
    {
      mode: 'create',
      label: 'Create New',
      icon: <PiPlusCircle className="h-4 w-4" />,
      description: 'Add a new product to the catalog',
    },
  ];

  return (
    <div className="mb-4">
      <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
        {tabs.map((tab) => {
          const isActive = activeMode === tab.mode;
          
          return (
            <button
              key={tab.mode}
              type="button"
              onClick={() => onModeChange(tab.mode)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="selectionTab"
                  className="absolute inset-0 rounded-md bg-white shadow-sm"
                  transition={{ type: 'spring', duration: 0.3 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {tab.icon}
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Mode Description */}
      <div className="mt-2 text-xs text-gray-500">
        {activeMode === 'search' && searchCount > 0 && (
          <span>{searchCount} products available in catalog</span>
        )}
        {activeMode === 'search' && searchCount === 0 && (
          <span>Search the central product catalog</span>
        )}
        {activeMode === 'create' && (
          <span>Create a new product - requires admin approval to appear on main site</span>
        )}
      </div>
    </div>
  );
}

export default ProductSelectionTabs;
