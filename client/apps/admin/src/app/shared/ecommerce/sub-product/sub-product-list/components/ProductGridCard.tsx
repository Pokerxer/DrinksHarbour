// @ts-nocheck
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
  PiWineBold,
  PiBeerBottleBold,
  PiDropBold,
  PiPackageBold,
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
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  KES: 'KSh',
  GHS: '₵',
};

const TYPE_COLORS: Record<string, string> = {
  whisky: 'from-amber-50 to-amber-100/60',
  whiskey: 'from-amber-50 to-amber-100/60',
  bourbon: 'from-orange-50 to-orange-100/60',
  scotch: 'from-yellow-50 to-yellow-100/60',
  rum: 'from-rose-50 to-rose-100/60',
  gin: 'from-sky-50 to-sky-100/60',
  vodka: 'from-slate-50 to-slate-100/60',
  tequila: 'from-lime-50 to-lime-100/60',
  wine: 'from-purple-50 to-purple-100/60',
  champagne: 'from-yellow-50 to-yellow-100/50',
  beer: 'from-amber-50 to-yellow-50',
  brandy: 'from-orange-50 to-amber-100/60',
  cognac: 'from-amber-50 to-orange-100/60',
};

const getBgGradient = (type?: string) => {
  if (!type) return 'from-gray-50 to-gray-100/60';
  const t = type.toLowerCase();
  for (const [key, val] of Object.entries(TYPE_COLORS)) {
    if (t.includes(key)) return val;
  }
  return 'from-gray-50 to-gray-100/60';
};

const getBeverageIcon = (type?: string) => {
  if (!type) return PiPackageBold;
  const t = type.toLowerCase();
  if (t.includes('wine') || t.includes('champagne')) return PiWineBold;
  if (
    t.includes('beer') ||
    t.includes('lager') ||
    t.includes('ale') ||
    t.includes('stout')
  )
    return PiBeerBottleBold;
  if (t.includes('water') || t.includes('juice') || t.includes('soft'))
    return PiDropBold;
  return PiPackageBold;
};

const stockBadge = (stock: number) => {
  if (stock === 0)
    return {
      label: 'Out of stock',
      dot: 'bg-red-500',
      text: 'text-red-600 bg-red-50',
    };
  if (stock <= 10)
    return {
      label: `Low · ${stock}`,
      dot: 'bg-amber-500',
      text: 'text-amber-700 bg-amber-50',
    };
  return {
    label: `${stock} in stock`,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 bg-emerald-50',
  };
};

export default function ProductGridCard({
  product,
  isSelected,
  onSelect,
  onEdit,
  onView,
  currencySymbol: propSymbol,
}: ProductGridCardProps) {
  const symbol = propSymbol || currencySymbols[product.currency] || '₦';
  const stock = stockBadge(product.totalStock);
  const BeverageIcon = getBeverageIcon(product.product?.type);
  const primaryImage =
    product.imagesOverride?.[0]?.url || product.product?.images?.[0]?.url;
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
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
      )}
    >
      {/* Image area */}
      <div
        className={cn(
          'relative flex items-center justify-center bg-gradient-to-br',
          bg,
          'aspect-[3/4]'
        )}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.product?.name || 'Product'}
            className="h-full w-full object-contain p-4 drop-shadow-sm"
          />
        ) : (
          <BeverageIcon className="h-14 w-14 text-gray-300" />
        )}

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
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-gray-600 shadow transition-colors hover:bg-white hover:text-[#b20202]"
            >
              <PiPencilSimpleBold className="h-3.5 w-3.5" />
            </button>
          </Link>
          {onView && (
            <button
              type="button"
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
        <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-gray-900">
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
          <span className="text-[13px] font-bold tabular-nums text-gray-900">
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

// ─── Compact card ────────────────────────────────────────────────────────────
export function ProductGridCardCompact({
  product,
  isSelected,
  onSelect,
  currencySymbol: propSymbol,
}: ProductGridCardProps) {
  const symbol = propSymbol || currencySymbols[product.currency] || '₦';
  const stock = stockBadge(product.totalStock);
  const primaryImage =
    product.imagesOverride?.[0]?.url || product.product?.images?.[0]?.url;
  const BeverageIcon = getBeverageIcon(product.product?.type);
  const productId = product._id || product.id;
  const base = product.baseSellingPrice || 0;
  const bg = getBgGradient(product.product?.type);

  const ps =
    product.sizes
      ?.map((s: SizeVariant) => s.sellingPrice || base)
      .filter((p: number) => p > 0) || [];
  const effective = ps.length ? ps : base > 0 ? [base] : [];
  const lo = effective.length ? Math.min(...effective) : 0;
  const hi = effective.length ? Math.max(...effective) : 0;

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
      <div
        className={cn(
          'relative flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br',
          bg
        )}
      >
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.product?.name || ''}
            className="h-full w-full rounded-lg object-contain p-1"
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
          {product.product?.name || 'Unknown'}
        </p>
        {product.product?.brand?.name && (
          <p className="truncate text-[10px] leading-none text-gray-400">
            {product.product.brand.name}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className="text-[11px] font-bold tabular-nums text-gray-900">
            {symbol}
            {lo.toLocaleString()}
            {lo !== hi ? (
              <span className="font-normal text-gray-400">
                –{hi.toLocaleString()}
              </span>
            ) : (
              ''
            )}
          </span>
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold',
              stock.text
            )}
          >
            {product.totalStock === 0
              ? 'Out'
              : product.totalStock <= 10
                ? `Low·${product.totalStock}`
                : product.totalStock}
          </span>
        </div>
      </div>

      {/* Edit — always visible on touch, hover-revealed on desktop */}
      <Link
        href={routes.eCommerce.editSubProduct(productId)}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
      >
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 transition-colors hover:bg-red-50 hover:text-[#b20202]"
        >
          <PiPencilSimpleBold className="h-3.5 w-3.5" />
        </button>
      </Link>
    </div>
  );
}
