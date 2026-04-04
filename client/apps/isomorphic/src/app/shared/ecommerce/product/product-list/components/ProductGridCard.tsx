// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge, Flex, Text, Tooltip, ActionIcon } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  PiPackageBold,
  PiPencilLineBold,
  PiEyeBold,
  PiCheckCircleBold,
  PiWarningBold,
  PiXCircleBold,
  PiWineBold,
  PiBeerBottleBold,
  PiDropBold,
  PiSparkle,
} from 'react-icons/pi';
import type { ProductListItem } from '../columns';

interface ProductGridCardProps {
  product: ProductListItem;
  isSelected: boolean;
  onSelect: () => void;
}

const getBeverageIcon = (type?: string) => {
  if (!type) return PiPackageBold;
  const t = type.toLowerCase();
  if (t.includes('wine') || t.includes('champagne')) return PiWineBold;
  if (t.includes('beer') || t.includes('lager') || t.includes('ale')) return PiBeerBottleBold;
  if (t.includes('water') || t.includes('juice')) return PiDropBold;
  return PiPackageBold;
};

export default function ProductGridCard({ product, isSelected, onSelect }: ProductGridCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const imageUrl = product.images?.find(i => i.isPrimary)?.url || product.images?.[0]?.url;
  const BeverageIcon = getBeverageIcon(product.type);
  const subCount = product.subProductCount ?? 0;

  const statusColor = !product.isPublished || product.status === 'draft' ? 'neutral'
    : product.status === 'discontinued' ? 'secondary'
    : 'success';
  const statusLabel = !product.isPublished || product.status === 'draft' ? 'Draft'
    : product.status === 'discontinued' ? 'Discontinued'
    : 'Published';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onSelect}
      className={cn(
        'relative bg-white rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden',
        isSelected ? 'border-blue-500 shadow-lg shadow-blue-500/15' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 left-3 z-10 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center"
        >
          <PiCheckCircleBold className="w-4 h-4 text-white" />
        </motion.div>
      )}

      {/* Status badge */}
      <div className="absolute top-3 right-3 z-10">
        <Badge color={statusColor} variant="flat" className="text-xs font-semibold shadow-sm">
          {statusLabel}
        </Badge>
      </div>

      {/* Image */}
      <div className="relative h-44 bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className={cn(
              'w-full h-full object-cover transition-transform duration-500',
              isHovered && 'scale-110'
            )}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BeverageIcon className="w-16 h-16 text-gray-300" />
          </div>
        )}

        {/* Hover actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 bg-black/40 flex items-center justify-center gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip size="sm" content="View" placement="top" color="invert">
            <Link href={routes.eCommerce.productDetails(product._id)}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <ActionIcon as="span" size="md" variant="solid" className="bg-white text-gray-800 hover:bg-blue-50">
                  <PiEyeBold className="w-4 h-4" />
                </ActionIcon>
              </motion.div>
            </Link>
          </Tooltip>
          <Tooltip size="sm" content="Edit" placement="top" color="invert">
            <Link href={routes.eCommerce.ediProduct(product._id)}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <ActionIcon as="span" size="md" variant="solid" className="bg-white text-gray-800 hover:bg-blue-50">
                  <PiPencilLineBold className="w-4 h-4" />
                </ActionIcon>
              </motion.div>
            </Link>
          </Tooltip>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        {product.category?.name && (
          <Badge color="primary" variant="flat" className="text-xs mb-2">{product.category.name}</Badge>
        )}

        {/* Name */}
        <Text className="font-bold text-gray-900 leading-snug line-clamp-2 mb-1">{product.name}</Text>

        {/* Brand + Type */}
        <Flex gap="2" className="mb-3">
          {product.brand?.name && <Text className="text-xs text-gray-500">{product.brand.name}</Text>}
          {product.type && <Text className="text-xs text-gray-400 capitalize">· {product.type}</Text>}
        </Flex>

        {/* Details row */}
        <Flex align="center" justify="between" className="pt-3 border-t border-gray-100">
          <Flex align="center" gap="1">
            {product.isAlcoholic !== undefined && (
              <Badge
                color={product.isAlcoholic ? 'warning' : 'success'}
                variant="flat"
                className="text-xs"
              >
                {product.isAlcoholic
                  ? `${product.abv ? `${product.abv}% ABV` : 'Alcoholic'}`
                  : 'Non-Alc'}
              </Badge>
            )}
            {product.volumeMl && (
              <Text className="text-xs text-gray-400">{product.volumeMl}ml</Text>
            )}
          </Flex>

          {/* Sub-products count */}
          <Flex align="center" gap="1">
            <div className={cn(
              'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold',
              subCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'
            )}>
              {subCount}
            </div>
            <Text className="text-xs text-gray-400">variants</Text>
          </Flex>
        </Flex>
      </div>
    </motion.div>
  );
}
