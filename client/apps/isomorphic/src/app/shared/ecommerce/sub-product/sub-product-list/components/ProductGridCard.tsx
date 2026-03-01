// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Text, Badge, Flex, Checkbox, ActionIcon, Tooltip } from 'rizzui';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  PiPackageBold,
  PiPencilSimpleBold,
  PiEyeBold,
  PiHeartBold,
  PiHeartFill,
  PiStarFill,
  PiTrendUpBold,
  PiSparkle,
  PiWineBold,
  PiBeerBottleBold,
  PiDropBold,
  PiCheckCircleBold,
  PiWarningBold,
  PiXCircleBold,
  PiEyeSlashBold,
  PiArrowsClockwiseBold,
  PiChartLineBold,
  PiCursorClickBold,
  PiWarehouseBold,
} from 'react-icons/pi';
import type { SubProductListItem, SizeVariant } from '../table';

interface ProductGridCardProps {
  product: SubProductListItem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: (product: SubProductListItem) => void;
  onView?: (product: SubProductListItem) => void;
  onToggleVisibility?: (product: SubProductListItem) => void;
  currencySymbol?: string;
}

const currencySymbols: Record<string, string> = {
  NGN: '₦', USD: '$', EUR: '€', GBP: '£', ZAR: 'R', KES: 'KSh', GHS: '₵',
};

// Get beverage icon based on type
const getBeverageIcon = (type?: string) => {
  if (!type) return PiPackageBold;
  const t = type.toLowerCase();
  if (t.includes('wine') || t.includes('champagne')) return PiWineBold;
  if (t.includes('beer') || t.includes('lager') || t.includes('ale') || t.includes('stout')) return PiBeerBottleBold;
  if (t.includes('water') || t.includes('juice') || t.includes('soft')) return PiDropBold;
  return PiPackageBold;
};

// Get stock status info
const getStockInfo = (stock: number) => {
  if (stock === 0) return { label: 'Out of Stock', color: 'danger', icon: PiXCircleBold, bg: 'bg-red-500' };
  if (stock <= 10) return { label: 'Low Stock', color: 'warning', icon: PiWarningBold, bg: 'bg-amber-500' };
  return { label: 'In Stock', color: 'success', icon: PiCheckCircleBold, bg: 'bg-green-500' };
};

export default function ProductGridCard({
  product,
  isSelected,
  onSelect,
  onEdit,
  onView,
  onToggleVisibility,
  currencySymbol: propSymbol,
}: ProductGridCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  
  const symbol = propSymbol || currencySymbols[product.currency] || '₦';
  const stockInfo = getStockInfo(product.totalStock);
  const BeverageIcon = getBeverageIcon(product.product?.type);
  
  // Calculate markup
  const markup = product.costPrice > 0 
    ? Math.round(((product.baseSellingPrice - product.costPrice) / product.costPrice) * 100) 
    : 0;
  
  // Get primary image
  const primaryImage = product.imagesOverride?.[0]?.url || product.product?.images?.[0]?.url;
  
  // Price range from sizes
  const prices = product.sizes && product.sizes.length > 0 
    ? product.sizes.map(s => s.sellingPrice ?? product.baseSellingPrice)
    : [product.baseSellingPrice];
  const minPrice = Math.min(...prices.filter(p => p !== undefined && !isNaN(p)));
  const maxPrice = Math.max(...prices.filter(p => p !== undefined && !isNaN(p)));
  const hasPriceRange = prices.length > 1 && minPrice !== maxPrice;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ 
        type: "spring", 
        stiffness: 300, 
        damping: 25,
        mass: 0.8
      }}
      whileHover={{ y: -6 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        'relative bg-white rounded-2xl border-2 overflow-hidden transition-all duration-300 group',
        isSelected 
          ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-lg shadow-blue-500/10' 
          : 'border-gray-100 hover:border-gray-300 hover:shadow-2xl'
      )}
    >
      {/* Selection Checkbox */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, x: -10 }}
        animate={{ 
          opacity: isHovered || isSelected ? 1 : 0, 
          scale: isHovered || isSelected ? 1 : 0.8,
          x: 0
        }}
        transition={{ duration: 0.2 }}
        className="absolute top-3 left-3 z-20"
      >
        <motion.div
          whileHover={{ scale: 1.15, rotate: 5 }}
          whileTap={{ scale: 0.85 }}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          className={cn(
            'w-7 h-7 rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-md',
            isSelected 
              ? 'bg-blue-500 text-white' 
              : 'bg-white/95 backdrop-blur-sm border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
          )}
        >
          {isSelected ? (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
            >
              <PiCheckCircleBold className="w-5 h-5" />
            </motion.div>
          ) : (
            <div className="w-3 h-3 rounded-full border-2 border-gray-300" />
          )}
        </motion.div>
      </motion.div>

      {/* Favorite Button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.5, x: 10 }}
        animate={{ 
          opacity: isHovered || isFavorite ? 1 : 0, 
          scale: isHovered || isFavorite ? 1 : 0.8,
          x: 0
        }}
        transition={{ duration: 0.2 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.85 }}
        onClick={(e) => { e.stopPropagation(); setIsFavorite(!isFavorite); }}
        className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-white/95 backdrop-blur-sm flex items-center justify-center shadow-md hover:shadow-lg"
      >
        <motion.div
          animate={{ 
            scale: isFavorite ? [1, 1.3, 1] : 1,
          }}
          transition={{ duration: 0.3 }}
        >
          {isFavorite ? (
            <PiHeartFill className="w-5 h-5 text-red-500" />
          ) : (
            <PiHeartBold className="w-5 h-5 text-gray-400" />
          )}
        </motion.div>
      </motion.button>

      {/* Badges */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
        {product.isFeaturedByTenant && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Badge size="sm" className="bg-amber-500 text-white border-0 shadow-sm">
              <PiStarFill className="w-3 h-3 mr-1" />
              Featured
            </Badge>
          </motion.div>
        )}
        {product.isBestSeller && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <Badge size="sm" className="bg-green-500 text-white border-0 shadow-sm">
              <PiTrendUpBold className="w-3 h-3 mr-1" />
              Best Seller
            </Badge>
          </motion.div>
        )}
        {product.isNewArrival && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Badge size="sm" className="bg-purple-500 text-white border-0 shadow-sm">
              <PiSparkle className="w-3 h-3 mr-1" />
              New
            </Badge>
          </motion.div>
        )}
      </div>

      {/* Image Container */}
      <motion.div 
        className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden"
      >
        {primaryImage ? (
          <motion.img
            src={primaryImage}
            alt={product.product?.name || 'Product'}
            className="w-full h-full object-cover"
            animate={{ scale: isHovered ? 1.08 : 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        ) : (
          <motion.div 
            className="w-full h-full flex items-center justify-center"
            animate={{ scale: isHovered ? 1.05 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{ 
                y: isHovered ? -5 : 0,
              }}
              transition={{ duration: 0.3 }}
            >
              <BeverageIcon className="w-24 h-24 text-gray-200" />
            </motion.div>
          </motion.div>
        )}

        {/* Image Overlay Gradient */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
        />

        {/* Stock Status Overlay */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="absolute bottom-3 left-3"
        >
          <Badge 
            size="sm" 
            className={cn(
              'border-0 shadow-md backdrop-blur-sm',
              stockInfo.bg,
              'text-white'
            )}
          >
            <stockInfo.icon className="w-3 h-3 mr-1" />
            {product.totalStock} in stock
          </Badge>
        </motion.div>

        {/* Quick Actions Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center gap-3"
        >
          <Link href={routes.eCommerce.editSubProduct(product._id || product.id)}>
            <motion.button
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20, scale: isHovered ? 1 : 0.8 }}
              transition={{ delay: 0.05, type: "spring", stiffness: 400 }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-blue-50"
              title="Edit Product"
            >
              <PiPencilSimpleBold className="w-5 h-5 text-gray-700" />
            </motion.button>
          </Link>
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20, scale: isHovered ? 1 : 0.8 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onView?.(product)}
            className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-blue-50"
            title="View Details"
          >
            <PiEyeBold className="w-5 h-5 text-gray-700" />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 20, scale: isHovered ? 1 : 0.8 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 400 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggleVisibility?.(product)}
            className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-amber-50"
            title={product.isPublished ? 'Unpublish' : 'Publish'}
          >
            {product.isPublished ? (
              <PiEyeSlashBold className="w-5 h-5 text-gray-700" />
            ) : (
              <PiEyeBold className="w-5 h-5 text-green-600" />
            )}
          </motion.button>
        </motion.div>

        {/* Sale Badge */}
        {product.isOnSale && (
          <div className="absolute top-12 -right-8 rotate-45 bg-red-500 text-white text-xs font-bold py-1 px-10 shadow-md">
            SALE
          </div>
        )}
      </motion.div>

      {/* Content */}
      <div className="p-3 sm:p-4 space-y-2 sm:space-y-3">
        {/* Category & Type */}
        <Flex align="center" gap="1" wrap="wrap" className="gap-1 sm:gap-2">
          <Badge size="sm" variant="flat" color="secondary" className="text-[8px] sm:text-[10px] capitalize">
            {product.product?.type?.replace(/_/g, ' ') || 'Beverage'}
          </Badge>
          {product.product?.isAlcoholic && (
            <Badge size="xs" color="warning" variant="solid" className="text-[7px] sm:text-[8px] px-1.5 sm:px-2 py-0.5">
              {product.product?.abv || 0}%
            </Badge>
          )}
          {product.product?.volumeMl && (
            <Badge size="xs" variant="outline" className="text-[7px] sm:text-[8px] px-1.5 sm:px-2 py-0.5 hidden xs:inline-flex">
              {product.product.volumeMl}ml
            </Badge>
          )}
        </Flex>

        {/* Product Name */}
        <Link href={routes.eCommerce.editSubProduct(product._id || product.id)}>
          <Text className="font-bold text-gray-800 text-sm sm:text-base line-clamp-2 leading-tight min-h-[2rem] sm:min-h-[2.5rem] hover:text-blue-600 transition-colors">
            {product.product?.name || 'Unknown Product'}
          </Text>
        </Link>

        {/* Origin & Brand - Hidden on very small screens */}
        {(product.product?.brand?.name || product.product?.originCountry) && (
          <Text className="text-[10px] sm:text-xs text-gray-500 hidden xs:block">
            {product.product?.brand?.name}
            {product.product?.brand?.name && product.product?.originCountry && ' • '}
            {product.product?.originCountry}
          </Text>
        )}

        {/* SKU - Hidden on mobile */}
        <Text className="text-[10px] sm:text-xs text-gray-400 font-mono hidden sm:block">
          SKU: {product.sku}
        </Text>

        {/* Variants - Show fewer on mobile */}
        {product.sizes && product.sizes.length > 0 && (
          <Flex gap="1" wrap="wrap" className="hidden xs:flex">
            {product.sizes.slice(0, 2).map((size: SizeVariant) => (
              <Badge 
                key={size._id} 
                size="sm" 
                variant="outline" 
                className="text-[8px] sm:text-[10px]"
              >
                {size.displayName?.replace(/\s*\(.*?\)\s*/g, '').trim() || size.size}
              </Badge>
            ))}
            {product.sizes.length > 2 && (
              <Badge size="sm" variant="flat" color="secondary" className="text-[8px] sm:text-[10px]">
                +{product.sizes.length - 2}
              </Badge>
            )}
          </Flex>
        )}

        {/* Price */}
        <div className="pt-2 border-t border-gray-100">
          <Flex align="end" justify="between" gap="2">
            <div className="min-w-0 flex-1">
              <Text className="text-[10px] sm:text-xs text-gray-400">Price</Text>
              <Text className="text-base sm:text-xl font-black text-gray-900 truncate">
                {symbol}{minPrice.toLocaleString()}
                {hasPriceRange && (
                  <span className="text-xs sm:text-sm font-normal text-gray-400 hidden sm:inline">
                    {' '}- {symbol}{maxPrice.toLocaleString()}
                  </span>
                )}
              </Text>
            </div>
            
            {/* Markup Badge */}
            {markup > 0 && (
              <Badge 
                size="sm" 
                color={markup >= 30 ? 'success' : markup >= 15 ? 'warning' : 'danger'}
                variant="flat"
                className="text-[10px] sm:text-xs font-bold flex-shrink-0"
              >
                +{markup}%
              </Badge>
            )}
          </Flex>

          {/* Cost Price */}
          {product.costPrice > 0 && (
            <Text className="text-[10px] sm:text-xs text-gray-400 mt-1 hidden sm:block">
              Cost: {symbol}{product.costPrice.toLocaleString()}
            </Text>
          )}
        </div>

        {/* Status Row */}
        <Flex align="center" justify="between" className="pt-1 sm:pt-2">
          <Badge 
            size="sm" 
            color={product.isPublished ? 'success' : 'neutral'} 
            variant="flat"
            className="text-[9px] sm:text-xs"
          >
            {product.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </Flex>

        {/* Performance Metrics - Hidden on mobile */}
        {(product.viewCount || product.conversionRate || product.totalSold) && (
          <div className="pt-2 mt-2 border-t border-gray-100 hidden md:block">
            <Flex align="center" gap="3" className="gap-3 sm:gap-4 text-[9px] sm:text-[10px] text-gray-500">
              {product.viewCount !== undefined && (
                <Flex align="center" gap="1" className="hover:text-blue-600 cursor-pointer">
                  <PiEyeBold className="w-3 h-3" />
                  <span>{product.viewCount.toLocaleString()}</span>
                </Flex>
              )}
              {product.conversionRate !== undefined && (
                <Flex align="center" gap="1" className="hover:text-green-600 cursor-pointer">
                  <PiCursorClickBold className="w-3 h-3" />
                  <span>{product.conversionRate.toFixed(1)}%</span>
                </Flex>
              )}
              {product.totalSold !== undefined && (
                <Flex align="center" gap="1" className="hover:text-purple-600 cursor-pointer">
                  <PiChartLineBold className="w-3 h-3" />
                  <span>{product.totalSold.toLocaleString()}</span>
                </Flex>
              )}
            </Flex>
          </div>
        )}

        {/* Last Activity - Hidden on mobile */}
        {(product.lastSoldDate || product.lastRestockDate) && (
          <Flex align="center" gap="2" className="text-[9px] sm:text-[10px] text-gray-400 hidden lg:flex">
            {product.lastSoldDate && (
              <span>Sold: {new Date(product.lastSoldDate).toLocaleDateString()}</span>
            )}
            {product.lastSoldDate && product.lastRestockDate && <span>•</span>}
            {product.lastRestockDate && (
              <span>Restocked: {new Date(product.lastRestockDate).toLocaleDateString()}</span>
            )}
          </Flex>
        )}
      </div>
    </motion.div>
  );
}

// Compact Grid Card Variant
export function ProductGridCardCompact({
  product,
  isSelected,
  onSelect,
  currencySymbol: propSymbol,
}: ProductGridCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const symbol = propSymbol || currencySymbols[product.currency] || '₦';
  const stockInfo = getStockInfo(product.totalStock);
  const primaryImage = product.imagesOverride?.[0]?.url || product.product?.images?.[0]?.url;
  const BeverageIcon = getBeverageIcon(product.product?.type);
  
  // Calculate markup
  const markup = product.costPrice > 0 
    ? Math.round(((product.baseSellingPrice - product.costPrice) / product.costPrice) * 100) 
    : 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ 
        type: "spring", 
        stiffness: 350, 
        damping: 25 
      }}
      whileHover={{ y: -4, scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn(
        'relative bg-white rounded-xl border-2 overflow-hidden transition-all cursor-pointer group',
        isSelected 
          ? 'border-blue-500 ring-4 ring-blue-500/20 shadow-lg shadow-blue-500/10' 
          : 'border-gray-100 hover:border-gray-300 hover:shadow-xl'
      )}
      onClick={onSelect}
    >
      {/* Image */}
      <div className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 overflow-hidden">
        {primaryImage ? (
          <motion.img 
            src={primaryImage} 
            alt={product.product?.name || ''} 
            className="w-full h-full object-cover"
            animate={{ scale: isHovered ? 1.08 : 1 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BeverageIcon className="w-12 h-12 text-gray-200" />
          </div>
        )}
        
        {/* Stock Status Badge */}
        <div className={cn(
          'absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[8px] font-bold text-white flex items-center gap-1',
          stockInfo.bg
        )}>
          <stockInfo.icon className="w-2.5 h-2.5" />
          {product.totalStock}
        </div>
        
        {/* Selection Checkbox */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: isHovered || isSelected ? 1 : 0, scale: 1 }}
          className="absolute top-2 left-2"
        >
          <div className={cn(
            'w-5 h-5 rounded-md flex items-center justify-center transition-all',
            isSelected 
              ? 'bg-blue-500 text-white' 
              : 'bg-white/90 border border-gray-300'
          )}>
            {isSelected && <PiCheckCircleBold className="w-3 h-3" />}
          </div>
        </motion.div>

        {/* Badges Row */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          {product.isFeaturedByTenant && (
            <span className="w-5 h-5 bg-amber-500 text-white text-[10px] rounded-md font-bold flex items-center justify-center">
              ★
            </span>
          )}
          {product.isBestSeller && (
            <span className="w-5 h-5 bg-green-500 text-white text-[10px] rounded-md font-bold flex items-center justify-center">
              ↑
            </span>
          )}
          {product.isOnSale && (
            <span className="w-5 h-5 bg-red-500 text-white text-[10px] rounded-md font-bold flex items-center justify-center">
              %
            </span>
          )}
        </div>

        {/* Quick Edit Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          className="absolute inset-0 bg-black/30 flex items-center justify-center"
        >
          <Link href={routes.eCommerce.editSubProduct(product._id || product.id)} onClick={(e) => e.stopPropagation()}>
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg"
            >
              <PiPencilSimpleBold className="w-4 h-4 text-gray-700" />
            </motion.div>
          </Link>
        </motion.div>
      </div>

      {/* Content */}
      <div className="p-2.5 space-y-1.5">
        {/* Type Badge */}
        <div className="flex items-center gap-1">
          <span className="text-[8px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-medium capitalize truncate">
            {product.product?.type?.replace(/_/g, ' ') || 'Beverage'}
          </span>
          {product.product?.isAlcoholic && (
            <span className="text-[8px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-bold">
              {product.product.abv || 0}%
            </span>
          )}
        </div>

        {/* Product Name */}
        <Text className="font-bold text-xs text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
          {product.product?.name || 'Unknown'}
        </Text>
        
        {/* SKU */}
        <Text className="text-[9px] text-gray-400 font-mono truncate">
          {product.sku}
        </Text>

        {/* Price Row */}
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
          <div>
            <Text className="font-black text-sm text-gray-900">
              {symbol}{product.baseSellingPrice.toLocaleString()}
            </Text>
            {product.costPrice > 0 && (
              <Text className="text-[9px] text-gray-400">
                Cost: {symbol}{product.costPrice.toLocaleString()}
              </Text>
            )}
          </div>
          {markup > 0 && (
            <span className={cn(
              'text-[9px] px-1.5 py-0.5 rounded font-bold',
              markup >= 30 ? 'bg-green-100 text-green-700' : markup >= 15 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            )}>
              +{markup}%
            </span>
          )}
        </div>

        {/* Status Row */}
        <div className="flex items-center justify-between pt-1.5">
          <span className={cn(
            'text-[8px] px-1.5 py-0.5 rounded font-semibold',
            product.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          )}>
            {product.isPublished ? 'Published' : 'Draft'}
          </span>
          
          {/* Variants count */}
          {product.sizes && product.sizes.length > 0 && (
            <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">
              {product.sizes.length} size{product.sizes.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Performance Mini Stats */}
        {(product.totalSold !== undefined || product.viewCount !== undefined) && (
          <div className="flex items-center gap-2 pt-1 text-[8px] text-gray-400">
            {product.totalSold !== undefined && product.totalSold > 0 && (
              <span className="flex items-center gap-0.5">
                <PiChartLineBold className="w-2.5 h-2.5" />
                {product.totalSold} sold
              </span>
            )}
            {product.viewCount !== undefined && product.viewCount > 0 && (
              <span className="flex items-center gap-0.5">
                <PiEyeBold className="w-2.5 h-2.5" />
                {product.viewCount}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
