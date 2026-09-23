// @ts-nocheck
'use client';

import { motion } from 'framer-motion';
import { Text } from 'rizzui';
import { PiPackageBold, PiPlus } from 'react-icons/pi';

/**
 * Page header for the /sub-products listing. Keeps the two create actions
 * ("New Sub-product" → the sub-product wizard, "Add Product" → the central
 * catalog product form) out of the toolbar so the toolbar stays search- and
 * filter-only.
 *
 * Subtitle is driven by real counts: total items in the store and, when
 * relevant, how many are low on stock.
 */
export default function SubProductsHeader({
  total,
  lowStock,
  onNew,
  onAddProduct,
}: {
  total: number;
  lowStock: number;
  onNew: () => void;
  onAddProduct: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <div>
        <Text className="text-xl font-bold text-gray-900 md:text-2xl">
          Sub-Products
        </Text>
        <Text className="mt-0.5 text-sm text-gray-500">
          {total} item{total !== 1 ? 's' : ''} available in your store
          {lowStock > 0 && (
            <span className="font-medium text-amber-600">
              {' '}
              · {lowStock} low on stock
            </span>
          )}
        </Text>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={onAddProduct}
          title="Create a catalog product"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-800"
        >
          <PiPackageBold className="h-3.5 w-3.5" />
          Add Product
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={onNew}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-[#b20202] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#7f1d1d]"
        >
          <PiPlus className="h-3.5 w-3.5" />
          New Sub-product
        </motion.button>
      </div>
    </motion.div>
  );
}