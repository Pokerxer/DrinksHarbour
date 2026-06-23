// @ts-nocheck
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import {
  PiPackageBold,
  PiPencilSimpleBold,
  PiEyeBold,
  PiStarFill,
  PiTrendUpBold,
  PiSparkle,
  PiWineBold,
  PiBeerBottleBold,
  PiDropBold,
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

const getBeverageIcon = (type?: string) => {
  if (!type) return PiPackageBold;
  const t = type.toLowerCase();
  if (t.includes('wine') || t.includes('champagne')) return PiWineBold;
  if (t.includes('beer') || t.includes('lager') || t.includes('ale') || t.includes('stout')) return PiBeerBottleBold;
  if (t.includes('water') || t.includes('juice') || t.includes('soft')) return PiDropBold;
  return PiPackageBold;
};

const getStockInfo = (stock: number) => {
  if (stock === 0) return { label: 'Out', bg: 'bg-red-500' };
  if (stock <= 10) return { label: 'Low', bg: 'bg-amber-500' };
  return { label: `${stock}`, bg: 'bg-green-500' };
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

  const symbol = propSymbol || currencySymbols[product.currency] || '₦';
  const stockInfo = getStockInfo(product.totalStock);
  const BeverageIcon = getBeverageIcon(product.product?.type);
  const primaryImage = product.imagesOverride?.[0]?.url || product.product?.images?.[0]?.url;
  const productId = product._id || product.id;

  const hasSizes = product.sizes && product.sizes.length > 0;
  const base = product.baseSellingPrice || 0;
  const sizePrices: { label: string; price: number; stock: number | undefined }[] = hasSizes
    ? product.sizes.map((s: SizeVariant) => ({
        label: s.displayName?.replace(/\s*\(.*?\)\s*/g, '').trim() || s.size,
        price: s.sellingPrice || base,
        stock: s.stock,
      }))
    : [];

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative flex bg-white rounded-xl border border-gray-200 overflow-hidden transition-shadow duration-200 hover:shadow-md hover:border-gray-300"
    >
      {/* Image — left, stretches to match content height */}
      <div className="relative w-20 shrink-0 self-stretch bg-gray-50 border-r border-gray-100">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.product?.name || 'Product'}
            className="absolute inset-0 w-full h-full object-contain p-1.5"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BeverageIcon className="w-8 h-8 text-gray-200" />
          </div>
        )}
        {/* Stock dot */}
        <span className={cn('absolute bottom-1.5 left-1.5 h-1.5 w-1.5 rounded-full', stockInfo.bg)} />
      </div>

      {/* Content — right */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5 gap-1.5">
        {/* Name + actions */}
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-semibold leading-tight text-gray-900 line-clamp-2 flex-1">
            {product.product?.name || 'Unknown Product'}
          </p>
          {/* Action buttons — shown on hover */}
          <div className={cn('flex shrink-0 items-center gap-0.5 transition-opacity', isHovered ? 'opacity-100' : 'opacity-0')}>
            <Link href={routes.eCommerce.editSubProduct(productId)} onClick={e => e.stopPropagation()}>
              <button type="button" title="Edit"
                className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <PiPencilSimpleBold className="h-3 w-3" />
              </button>
            </Link>
            <button type="button" title="View" onClick={e => { e.stopPropagation(); onView?.(product); }}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
              <PiEyeBold className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Prices */}
        <div className="space-y-0.5">
          {sizePrices.length > 0 ? (
            <>
              {sizePrices.slice(0, 3).map((sp, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 truncate flex-1">{sp.label}</span>
                  <span className={cn(
                    'shrink-0 rounded px-1 py-px text-[9px] font-semibold tabular-nums',
                    sp.stock === 0 ? 'bg-red-50 text-red-600' : sp.stock != null && sp.stock <= 10 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                  )}>
                    {sp.stock ?? '—'}
                  </span>
                  <span className="text-[10px] font-semibold text-gray-800 tabular-nums shrink-0">
                    {symbol}{sp.price.toLocaleString()}
                  </span>
                </div>
              ))}
              {sizePrices.length > 3 && (
                <p className="text-[9px] text-gray-400">+{sizePrices.length - 3} more</p>
              )}
            </>
          ) : (
            <p className="text-[11px] font-bold text-gray-900 tabular-nums">
              {symbol}{base.toLocaleString()}
            </p>
          )}
        </div>

        {/* Footer: badges + stock */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 flex-wrap">
            {product.isFeaturedByTenant && (
              <span className="flex items-center gap-0.5 rounded px-1 py-px bg-amber-100 text-amber-700 text-[8px] font-semibold">
                <PiStarFill className="h-2 w-2" /> Feat.
              </span>
            )}
            {product.isBestSeller && (
              <span className="flex items-center gap-0.5 rounded px-1 py-px bg-green-100 text-green-700 text-[8px] font-semibold">
                <PiTrendUpBold className="h-2 w-2" /> Top
              </span>
            )}
            {product.isNewArrival && (
              <span className="flex items-center gap-0.5 rounded px-1 py-px bg-purple-100 text-purple-700 text-[8px] font-semibold">
                <PiSparkle className="h-2 w-2" /> New
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={cn('rounded px-1.5 py-px text-[9px] font-bold text-white', stockInfo.bg)}>
              {stockInfo.label}
            </span>
            <span className={cn('rounded px-1.5 py-px text-[9px] font-semibold',
              product.isPublished ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
              {product.isPublished ? '●' : '○'}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Compact variant — same horizontal layout, slimmer
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
  const productId = product._id || product.id;
  const base = product.baseSellingPrice || 0;
  const ps = product.sizes && product.sizes.length > 0
    ? product.sizes.map((s: SizeVariant) => s.sellingPrice || base).filter((p: number) => !isNaN(p) && p > 0)
    : [];
  const effective = ps.length > 0 ? ps : (base > 0 ? [base] : []);
  const lo = effective.length ? Math.min(...effective) : 0;
  const hi = effective.length ? Math.max(...effective) : 0;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex bg-white rounded-lg border border-gray-200 overflow-hidden transition-shadow duration-200 hover:shadow-sm hover:border-gray-300"
    >
      {/* Image */}
      <div className="relative w-14 shrink-0 self-stretch bg-gray-50 border-r border-gray-100">
        {primaryImage ? (
          <img src={primaryImage} alt={product.product?.name || ''} className="absolute inset-0 w-full h-full object-contain p-1" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BeverageIcon className="w-6 h-6 text-gray-200" />
          </div>
        )}
        <span className={cn('absolute bottom-1 left-1 h-1.5 w-1.5 rounded-full', stockInfo.bg)} />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between p-2 gap-1">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[10px] font-semibold leading-tight text-gray-900 line-clamp-2 flex-1">
            {product.product?.name || 'Unknown'}
          </p>
          {isHovered && (
            <Link href={routes.eCommerce.editSubProduct(productId)} onClick={e => e.stopPropagation()}>
              <button type="button" className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <PiPencilSimpleBold className="h-2.5 w-2.5" />
              </button>
            </Link>
          )}
        </div>
        {effective.length > 0 && (
          <p className="text-[10px] font-bold text-gray-900 tabular-nums">
            {symbol}{lo.toLocaleString()}{lo !== hi ? `–${symbol}${hi.toLocaleString()}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}
