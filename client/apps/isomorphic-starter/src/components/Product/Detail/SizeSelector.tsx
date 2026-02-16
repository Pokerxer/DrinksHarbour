'use client';

import React, { useMemo } from 'react';
import * as Icon from 'react-icons/pi';

interface VendorSize {
  _id: string;
  size: string;
  displayName: string;
  stock: number;
  availability: string;
  price: number;
  originalPrice?: number;
  displayPrice: string;
  currencySymbol: string;
  discount?: { label?: string; percentage?: number } | null;
  volumeMl?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
}

interface SizeSelectorProps {
  sizes: VendorSize[];
  selectedSize: string;
  onSelect: (size: string) => void;
  showPrice?: boolean;
  layout?: 'horizontal' | 'vertical';
}

const SizeSelector: React.FC<SizeSelectorProps> = React.memo(
  ({ sizes, selectedSize, onSelect, showPrice = true, layout = 'horizontal' }) => {
    const selectedSizeData = useMemo(() => 
      sizes.find((s) => s.size === selectedSize),
      [sizes, selectedSize]
    );

    if (sizes.length === 0) return null;

    const containerClass = layout === 'horizontal' 
      ? 'flex flex-wrap gap-3' 
      : 'flex flex-col gap-2';

    return (
      <div className="size-selector">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon.PiRuler size={18} className="text-gray-500" />
            <label className="text-sm font-semibold text-gray-900">Select Size</label>
          </div>
          {selectedSizeData && (
            <div className="text-right">
              <span className="text-sm font-medium text-gray-900">
                {selectedSizeData.displayName}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({selectedSizeData.stock} available)
              </span>
            </div>
          )}
        </div>

        {/* Size Options */}
        <div className={containerClass}>
          {sizes.map((size) => {
            const isSelected = selectedSize === size.size;
            const isOutOfStock = size.stock === 0;
            const hasDiscount = size.discount && (size.discount.percentage || size.discount.label);
            const discountPercentage = size.originalPrice && size.originalPrice > size.price
              ? Math.round(((size.originalPrice - size.price) / size.originalPrice) * 100)
              : 0;

            return (
              <button
                key={size._id || size.size}
                onClick={() => !isOutOfStock && onSelect(size.size)}
                disabled={isOutOfStock}
                className={`
                  relative group flex items-center justify-between
                  ${layout === 'horizontal' ? 'min-w-[100px] px-4 py-3' : 'w-full px-4 py-3'}
                  rounded-xl border-2 transition-all duration-200
                  ${isSelected
                    ? 'border-orange-500 bg-orange-500 text-white shadow-lg shadow-orange-500/25'
                    : isOutOfStock
                      ? 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
                      : 'border-gray-200 bg-white text-gray-900 hover:border-orange-300 hover:shadow-md'
                  }
                `}
              >
                {/* Left: Size Info */}
                <div className="flex flex-col items-start">
                  <span className={`font-bold ${layout === 'horizontal' ? 'text-sm' : 'text-base'}`}>
                    {size.displayName}
                  </span>
                  
                  {size.volumeMl && (
                    <span className={`text-xs ${isSelected ? 'text-orange-100' : 'text-gray-500'}`}>
                      {size.volumeMl}ml
                    </span>
                  )}

                  {/* Stock Indicator */}
                  {!isOutOfStock && (
                    <span className={`text-[10px] mt-1 ${
                      size.stock <= 5 
                        ? isSelected ? 'text-orange-100' : 'text-red-500 font-medium'
                        : isSelected ? 'text-orange-100' : 'text-green-600'
                    }`}>
                      {size.stock <= 5 ? `Only ${size.stock} left` : `${size.stock} in stock`}
                    </span>
                  )}
                </div>

                {/* Right: Price Info */}
                {showPrice && (
                  <div className="flex flex-col items-end ml-3">
                    {/* Current Price */}
                    <span className={`font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {size.currencySymbol}{size.price.toFixed(2)}
                    </span>
                    
                    {/* Original Price (if discounted) */}
                    {(hasDiscount || discountPercentage > 0) && size.originalPrice && (
                      <span className={`text-xs line-through ${isSelected ? 'text-orange-200' : 'text-gray-400'}`}>
                        {size.currencySymbol}{size.originalPrice.toFixed(2)}
                      </span>
                    )}
                  </div>
                )}

                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-gray-100/80 rounded-xl flex items-center justify-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Out of Stock
                    </span>
                  </div>
                )}

                {/* Discount Badge */}
                {(hasDiscount || discountPercentage > 0) && !isOutOfStock && (
                  <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full shadow-sm">
                    {size.discount?.label || `-${discountPercentage}%`}
                  </div>
                )}

                {/* Selected Checkmark */}
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md">
                    <Icon.PiCheckBold size={12} className="text-orange-500" />
                  </div>
                )}

                {/* Availability Badge */}
                {size.availability === 'limited' && !isOutOfStock && !isSelected && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold rounded-full">
                    Limited
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Size Summary */}
        {selectedSizeData && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon.PiCheckCircle size={18} className="text-green-500" />
                <span className="font-medium text-gray-900">
                  {selectedSizeData.displayName}
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-gray-900">
                  {selectedSizeData.currencySymbol}{selectedSizeData.price.toFixed(2)}
                </span>
                {selectedSizeData.originalPrice && selectedSizeData.originalPrice > selectedSizeData.price && (
                  <span className="text-sm text-gray-400 line-through ml-2">
                    {selectedSizeData.currencySymbol}{selectedSizeData.originalPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className={`${selectedSizeData.stock <= 5 ? 'text-red-500 font-medium' : 'text-gray-600'}`}>
                {selectedSizeData.stock <= 5 
                  ? `⚠️ Only ${selectedSizeData.stock} items left` 
                  : `✓ ${selectedSizeData.stock} items available`}
              </span>
              {selectedSizeData.minOrderQuantity && selectedSizeData.minOrderQuantity > 1 && (
                <span className="text-gray-500">
                  Min: {selectedSizeData.minOrderQuantity}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);

SizeSelector.displayName = 'SizeSelector';

export default SizeSelector;
