// @ts-nocheck
'use client';

/**
 * "What is this banner for?" context target cards for the AI generator.
 * One card per target type; clicking opens its picker below (and clears the
 * other targets), clicking again clears + collapses it.
 */

import {
  PiPackage,
  PiFolder,
  PiStorefrontBold,
  PiCheckBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

type TargetType = 'product' | 'category' | 'subcategory' | 'brand';

interface ContextDataShape {
  productId: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
}

function TargetCard({
  label,
  icon,
  active,
  hint,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative rounded-xl border-2 p-4 text-left transition-all',
        active ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-purple-300'
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            active ? 'bg-purple-100' : 'bg-gray-100'
          )}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="truncate text-xs text-gray-500">
            {active ? hint : 'Click to choose'}
          </p>
        </div>
        {active && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 text-white">
            <PiCheckBold className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  );
}

export function ContextTargetCards({
  contextData,
  activeTarget,
  selectedProductName,
  categoryName,
  subcategoryName,
  brandName,
  onToggle,
  onClear,
}: {
  contextData: ContextDataShape;
  activeTarget: TargetType | null;
  selectedProductName?: string;
  categoryName?: string;
  subcategoryName?: string;
  brandName?: string;
  onToggle: (t: TargetType) => void;
  onClear: () => void;
}) {
  const selectedNames: Record<TargetType, string | undefined> = {
    product: selectedProductName,
    category: categoryName,
    subcategory: subcategoryName,
    brand: brandName,
  };
  const openHints: Record<TargetType, string> = {
    product: 'Type below to search',
    category: 'Pick below',
    subcategory: 'Type below to search',
    brand: 'Type below to search',
  };

  const cards: Array<{
    key: TargetType;
    label: string;
    icon: (active: boolean) => React.ReactNode;
  }> = [
    {
      key: 'product',
      label: 'Product',
      icon: (active) => (
        <PiPackage className={cn('h-5 w-5', active ? 'text-purple-600' : 'text-gray-400')} />
      ),
    },
    {
      key: 'category',
      label: 'Category',
      icon: (active) => (
        <PiFolder className={cn('h-5 w-5', active ? 'text-purple-600' : 'text-gray-400')} />
      ),
    },
    {
      key: 'subcategory',
      label: 'Subcategory',
      icon: (active) => (
        <PiFolder className={cn('h-5 w-5', active ? 'text-purple-600' : 'text-gray-400')} />
      ),
    },
    {
      key: 'brand',
      label: 'Brand',
      icon: (active) => (
        <PiStorefrontBold
          className={cn('h-5 w-5', active ? 'text-purple-600' : 'text-gray-400')}
        />
      ),
    },
  ];

  return (
    <div>
      <label className="mb-3 block text-sm font-semibold text-gray-700">
        What is this banner for?
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((card) => {
          const selectedId = contextData[`${card.key}Id` as keyof ContextDataShape];
          const active = Boolean(selectedId) || activeTarget === card.key;
          const hint = selectedId
            ? selectedNames[card.key] || 'Selected'
            : openHints[card.key];
          return (
            <TargetCard
              key={card.key}
              label={card.label}
              icon={card.icon(active)}
              active={active}
              hint={hint}
              onClick={() => onToggle(card.key)}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={onClear}
        className="col-span-2 mt-3 w-full rounded-xl border-2 border-dashed border-gray-300 p-3 text-center transition-all hover:border-purple-300 sm:col-span-4"
      >
        <p className="text-xs text-gray-500">
          Or generate without specific context
        </p>
      </button>
    </div>
  );
}
