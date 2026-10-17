'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  PiPencilSimpleBold,
  PiEyeBold,
  PiStarFill,
  PiTrendUpBold,
  PiSparkle,
  PiImagesBold as PiImages,
} from 'react-icons/pi';
import type { SubProductListItem, SizeVariant } from '../table';
import SubProductImage from './SubProductImage';

export interface ProductGridCardProps {
  product: SubProductListItem;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: (product: SubProductListItem) => void;
  onView?: (product: SubProductListItem) => void;
  onToggleVisibility?: (product: SubProductListItem) => void;
  currencySymbol?: string;
}

import {
  currencySymbols,
  getBgGradient,
  getBeverageIcon,
  stockBadge,
} from './product-card-utils';
export default function ProductGridCard({
  product,
  isSelected,
  onSelect,
  onView,
  currencySymbol: propSymbol,
}: ProductGridCardProps) {
  const symbol = propSymbol || currencySymbols[product.currency] || '₦';
  const stock = stockBadge(product.totalStock, product.lowStockThreshold ?? 10);
  const BeverageIcon = getBeverageIcon(product.product?.type);
  const productId = product._id || product.id;
  const base = product.baseSellingPrice || 0;
  const bg = getBgGradient(product.product?.type);

  const primarySize = product.sizes?.[0];
  const price = primarySize?.sellingPrice || base;

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.15 }}
      onClick={onSelect}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200',
        isSelected
          ? 'border-[#b20202]/60 shadow-md shadow-red-100 ring-2 ring-[#b20202]/30'
          : 'border-gray-200 hover:border-gray-300 hover:shadow-lg hover:shadow-[#b20202]/10'
      )}
    >
      {/* Image area */}
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-gradient-to-br',
          bg,
          'aspect-[4/5]'
        )}
      >
        <SubProductImage
          sp={product}
          alt={product.product?.name || 'Product'}
          className="h-full w-full object-cover"
          fallback={<BeverageIcon className="h-14 w-14 text-gray-300" />}
        />

        {/* Subtle inner vignette for depth */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.07] via-transparent to-transparent" />

        {/* Top badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.isFeaturedByTenant && (
            <span className="flex items-center gap-0.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
              <PiStarFill className="h-2.5 w-2.5" /> Featured
            </span>
          )}
          {product.isNewArrival && (
            <span className="flex items-center gap-0.5 rounded-full bg-purple-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
              <PiSparkle className="h-2.5 w-2.5" /> New
            </span>
          )}
          {product.isBestSeller && (
            <span className="flex items-center gap-0.5 rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
              <PiTrendUpBold className="h-2.5 w-2.5" /> Best seller
            </span>
          )}
        </div>

        {/* Hover actions — always visible on touch, hover-revealed on desktop */}
        <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-100 transition-opacity duration-150 md:opacity-0 md:group-hover:opacity-100">
          <Link
            href={routes.eCommerce.editSubProduct(productId)}
            prefetch={false}
            aria-label={`Edit ${product.product?.name || 'product'}`}
            onClick={(event) => event.stopPropagation()}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow transition-colors hover:bg-white hover:text-[#b20202]"
          >
            <PiPencilSimpleBold className="h-3.5 w-3.5" />
          </Link>
          {onView && (
            <button
              type="button"
              aria-label={`View ${product.product?.name || 'product'}`}
              onClick={(e) => {
                e.stopPropagation();
                onView(product);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow transition-colors hover:bg-white hover:text-[#b20202]"
            >
              <PiEyeBold className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Image count badge (for products with multiple images) */}
        {(() => {
          const imgCount =
            (product.imagesOverride?.length || 0) +
            (product.product?.images?.length || 0);
          if (imgCount <= 1) return null;
          return (
            <span className="absolute bottom-2 left-2 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
              <PiImages className="h-2.5 w-2.5" />
              {imgCount}
            </span>
          );
        })()}

        {/* Stock dot */}
        <span
          className={cn(
            'absolute bottom-2 right-2 h-2 w-2 rounded-full border-2 border-white shadow-sm',
            stock.dot
          )}
        />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Type tag */}
        {product.product?.type && (
          <span className="self-start rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-gray-500">
            {product.product.type}
          </span>
        )}

        {/* Name */}
        <p className="line-clamp-2 text-sm font-semibold leading-tight text-gray-900">
          {product.product?.name || 'Unknown Product'}
        </p>

        {/* Brand */}
        {product.product?.brand?.name && (
          <p className="text-[11px] leading-none text-gray-500">
            {product.product.brand.name}
          </p>
        )}

        {/* Size chips */}
        {product.sizes && product.sizes.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {product.sizes.slice(0, 4).map((s: SizeVariant) => (
              <span
                key={s._id}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600"
              >
                {s.displayName || s.size}
              </span>
            ))}
            {product.sizes.length > 4 && (
              <span className="self-center text-[10px] text-gray-400">
                +{product.sizes.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Price + stock */}
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-1">
          <span className="text-sm font-bold tabular-nums text-gray-900">
            {symbol}
            {price.toLocaleString()}
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold',
              stock.text
            )}
          >
            {stock.label}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export { default as ProductGridCardCompact } from './ProductGridCardCompact';
