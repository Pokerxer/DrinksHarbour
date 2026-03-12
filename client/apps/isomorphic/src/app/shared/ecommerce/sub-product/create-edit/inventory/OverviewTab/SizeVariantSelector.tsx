'use client';

import { Text, Badge } from 'rizzui';
import { motion } from 'framer-motion';
import { PiPackage } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';
import type { SizeVariant } from '../shared/types';

interface SizeVariantSelectorProps {
  sizes: SizeVariant[];
  selectedSize: string;
  sizeStockMap: Record<string, number>;
  onSelectSize: (size: string) => void;
}

export function SizeVariantSelector({
  sizes,
  selectedSize,
  sizeStockMap,
  onSelectSize,
}: SizeVariantSelectorProps) {
  const currentSizeStock = sizeStockMap[selectedSize] || 0;
  const currentSizeLabel = sizes.find((s) => s?.size === selectedSize)?.label || selectedSize;

  return (
    <motion.div
      variants={fieldStaggerVariants}
      className="rounded-xl border border-purple-200 bg-purple-50 p-4"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <PiPackage className="h-5 w-5 text-purple-600" />
          <Text className="font-medium text-purple-800">Size Variant</Text>
        </div>

        <div className="flex gap-2 flex-wrap">
          {sizes.map((s) => (
            <button
              key={s?.size}
              type="button"
              onClick={() => onSelectSize(s?.size)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                selectedSize === s?.size
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-100'
              }`}
            >
              {s?.label || s?.size}
              <span
                className={`ml-2 ${
                  selectedSize === s?.size ? 'text-purple-200' : 'text-purple-500'
                }`}
              >
                ({sizeStockMap[s?.size] || 0})
              </span>
            </button>
          ))}
        </div>

        {selectedSize && (
          <div className="ml-auto">
            <Badge color="primary" variant="flat">
              Current: {currentSizeLabel} - {currentSizeStock} units
            </Badge>
          </div>
        )}
      </div>
    </motion.div>
  );
}
