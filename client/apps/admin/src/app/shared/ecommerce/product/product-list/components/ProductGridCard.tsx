// @ts-nocheck
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Badge, Flex, Text } from 'rizzui';
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
  if (t.includes('beer') || t.includes('lager') || t.includes('ale'))
    return PiBeerBottleBold;
  if (t.includes('water') || t.includes('juice')) return PiDropBold;
  return PiPackageBold;
};

export default function ProductGridCard({
  product,
  isSelected,
  onSelect,
}: ProductGridCardProps) {
  const imageUrl =
    product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url;
  const BeverageIcon = getBeverageIcon(product.type);
  const variantCount = product.variantCount ?? product.subProductCount ?? 0;

  const statusColor =
    !product.isPublished || product.status === 'draft'
      ? 'secondary'
      : product.status === 'discontinued'
        ? 'secondary'
        : 'success';
  const statusLabel =
    !product.isPublished || product.status === 'draft'
      ? 'Draft'
      : product.status === 'discontinued'
        ? 'Discontinued'
        : 'Published';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      onClick={onSelect}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-white transition-all duration-200',
        isSelected
          ? 'border-[#b20202] shadow-lg shadow-[#b20202]/15'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-[#b20202]"
        >
          <PiCheckCircleBold className="h-4 w-4 text-white" />
        </motion.div>
      )}

      {/* Status badge */}
      <div className="absolute right-3 top-3 z-10">
        <Badge
          color={statusColor}
          variant="flat"
          className="text-xs font-semibold shadow-sm"
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Image */}
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-contain p-4 drop-shadow-sm"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <BeverageIcon className="h-16 w-16 text-gray-300" />
        )}

        {/* Actions — always visible on touch, hover-revealed on desktop */}
        <div
          className="absolute right-3 top-12 z-10 flex flex-col gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <Link href={routes.eCommerce.productDetails(product._id)}>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow transition-colors hover:bg-white hover:text-[#b20202]"
            >
              <PiEyeBold className="h-3.5 w-3.5" />
            </button>
          </Link>
          <Link href={routes.eCommerce.ediProduct(product._id)}>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow transition-colors hover:bg-white hover:text-[#b20202]"
            >
              <PiPencilLineBold className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        {product.category?.name && (
          <Badge color="primary" variant="flat" className="mb-2 text-xs">
            {product.category.name}
          </Badge>
        )}

        {/* Name */}
        <Text className="mb-1 line-clamp-2 font-bold leading-snug text-gray-900">
          {product.name}
        </Text>

        {/* Brand + Type */}
        <Flex gap="2" className="mb-3">
          {product.brand?.name && (
            <Text className="text-xs text-gray-500">{product.brand.name}</Text>
          )}
          {product.type && (
            <Text className="text-xs capitalize text-gray-400">
              · {product.type}
            </Text>
          )}
        </Flex>

        {/* Details row */}
        <Flex
          align="center"
          justify="between"
          className="border-t border-gray-100 pt-3"
        >
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
              <Text className="text-xs text-gray-400">
                {product.volumeMl}ml
              </Text>
            )}
          </Flex>

          {/* Variant count */}
          <Flex align="center" gap="1">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold',
                variantCount > 0
                  ? 'bg-red-50 text-[#b20202]'
                  : 'bg-gray-100 text-gray-400'
              )}
            >
              {variantCount}
            </div>
            <Text className="text-xs text-gray-400">variants</Text>
          </Flex>
        </Flex>
      </div>
    </motion.div>
  );
}

// ─── Compact card ────────────────────────────────────────────────────────────
const stockChip = (stock?: number) => {
  const s = stock ?? 0;
  if (s === 0)
    return { label: 'Out', dot: 'bg-red-500', text: 'text-red-600 bg-red-50' };
  if (s <= 10)
    return {
      label: `Low·${s}`,
      dot: 'bg-amber-500',
      text: 'text-amber-700 bg-amber-50',
    };
  return {
    label: `${s}`,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 bg-emerald-50',
  };
};

export function ProductGridCardCompact({
  product,
  isSelected,
  onSelect,
}: ProductGridCardProps) {
  const imageUrl =
    product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url;
  const BeverageIcon = getBeverageIcon(product.type);
  const variantCount = product.variantCount ?? product.subProductCount ?? 0;
  const stock = stockChip(product.totalStock);

  return (
    <div
      onClick={onSelect}
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 rounded-xl border bg-white p-2 transition-all duration-150',
        isSelected
          ? 'border-[#b20202]/60 bg-red-50/40 ring-1 ring-[#b20202]/30'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
      )}
    >
      {/* Image */}
      <div className="relative flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gray-50 to-gray-100">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name || ''}
            className="h-full w-full rounded-lg object-contain p-1"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <BeverageIcon className="h-6 w-6 text-gray-300" />
        )}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
            stock.dot
          )}
        />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-[11px] font-semibold leading-tight text-gray-900">
          {product.name || 'Unknown'}
        </p>
        {product.brand?.name && (
          <p className="truncate text-[10px] leading-none text-gray-400">
            {product.brand.name}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className="text-[11px] font-medium tabular-nums text-gray-500">
            {variantCount} variant{variantCount !== 1 ? 's' : ''}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold',
              stock.text
            )}
          >
            {stock.label}
          </span>
        </div>
      </div>

      {/* Edit — always visible on touch, hover-revealed on desktop */}
      <Link
        href={routes.eCommerce.ediProduct(product._id)}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
      >
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-red-50 hover:text-[#b20202]"
        >
          <PiPencilLineBold className="h-3.5 w-3.5" />
        </button>
      </Link>
    </div>
  );
}
