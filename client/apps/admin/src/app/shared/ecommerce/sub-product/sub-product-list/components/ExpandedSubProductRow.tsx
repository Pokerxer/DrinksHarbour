'use client';

// Expanded row body for the sub-products list view: size variants,
// catalog product info, and sales/revenue summary.

import { motion } from 'framer-motion';
import { Text, Badge, Flex } from 'rizzui';
import { PiPackageBold } from 'react-icons/pi';
import {
  currencySymbol,
  type SubProductListItem,
  type SizeVariant,
} from '../filtering';

export default function ExpandedSubProductRow({
  subProduct,
}: {
  subProduct: SubProductListItem;
}) {
  const symbol = currencySymbol(subProduct.currency) || subProduct.currency;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-gray-200 bg-gradient-to-r from-red-50/60 via-white to-gray-50 p-6"
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Size Variants */}
        <div className="md:col-span-2">
          <Text className="mb-3 flex items-center gap-2 font-bold text-gray-800">
            <PiPackageBold className="h-5 w-5" />
            Size Variants ({subProduct.sizes?.length || 0})
          </Text>
          <div className="space-y-2">
            {subProduct.sizes?.map((size) => (
              <SizeVariantRow key={size._id} size={size} symbol={symbol} />
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <Text className="mb-3 font-bold text-gray-800">Product Info</Text>
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
            <div>
              <Text className="text-xs text-gray-400">Product Name</Text>
              <Text className="font-semibold">
                {subProduct.product?.name || 'N/A'}
              </Text>
            </div>
            <div>
              <Text className="text-xs text-gray-400">Type</Text>
              <Text className="font-semibold capitalize">
                {subProduct.product?.type?.replace(/_/g, ' ') || 'N/A'}
              </Text>
            </div>
            <div>
              <Text className="text-xs text-gray-400">Status</Text>
              <Badge
                color={subProduct.status === 'active' ? 'success' : 'secondary'}
                variant="flat"
              >
                {subProduct.status}
              </Badge>
            </div>
          </div>
        </div>

        {/* Sales Info */}
        <div>
          <Text className="mb-3 font-bold text-gray-800">Sales & Revenue</Text>
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
            <div>
              <Text className="text-xs text-gray-400">Total Sold</Text>
              <Text className="text-xl font-bold">{subProduct.totalSold || 0}</Text>
            </div>
            <div>
              <Text className="text-xs text-gray-400">Total Revenue</Text>
              <Text className="font-bold text-green-600">
                {symbol}
                {(subProduct.totalRevenue || 0).toLocaleString()}
              </Text>
            </div>
            <div>
              <Text className="text-xs text-gray-400">Created</Text>
              <Text className="text-sm">
                {new Date(subProduct.createdAt).toLocaleDateString()}
              </Text>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SizeVariantRow({ size, symbol }: { size: SizeVariant; symbol: string }) {
  const threshold = size.lowStockThreshold || 10;
  const stock = size.stock ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-3"
    >
      <div>
        <Text className="font-semibold">{size.displayName || size.size}</Text>
        <Text className="text-xs text-gray-500">Threshold: {threshold}</Text>
      </div>
      <Flex align="center" gap="4">
        <div className="text-right">
          <Text className="text-xs text-gray-400">Price</Text>
          <Text className="font-bold">
            {symbol}
            {(size.sellingPrice || 0).toLocaleString()}
          </Text>
        </div>
        <div className="text-right">
          <Text className="text-xs text-gray-400">Stock</Text>
          <Badge
            size="sm"
            color={
              stock === 0 ? 'danger' : stock <= threshold ? 'warning' : 'success'
            }
          >
            {stock}
          </Badge>
        </div>
      </Flex>
    </motion.div>
  );
}
