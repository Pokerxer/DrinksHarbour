'use client';
import Link from 'next/link';
import cn from '@core/utils/class-names';
import { routes } from '@/config/routes';
import { PiPencilSimpleBold } from 'react-icons/pi';
import type { SizeVariant } from '../filtering';
import type { ProductGridCardProps } from './ProductGridCard';
import SubProductImage from './SubProductImage';
import {
  currencySymbols,
  getBgGradient,
  getBeverageIcon,
  stockBadge,
} from './product-card-utils';
// ─── Compact card ────────────────────────────────────────────────────────────
export default function ProductGridCardCompact({
  product,
  isSelected,
  onSelect,
  currencySymbol: propSymbol,
}: ProductGridCardProps) {
  const symbol = propSymbol || currencySymbols[product.currency] || '₦';
  const stock = stockBadge(product.totalStock, product.lowStockThreshold ?? 10);
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
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md hover:shadow-[#b20202]/10'
      )}
    >
      {/* Image */}
      <div
        className={cn(
          'relative flex h-14 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br',
          bg
        )}
      >
        <SubProductImage
          sp={product}
          alt={product.product?.name || ''}
          className="h-full w-full rounded-lg object-contain p-1"
          fallback={<BeverageIcon className="h-6 w-6 text-gray-300" />}
        />
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
            stock.dot
          )}
        />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="truncate text-xs font-semibold leading-tight text-gray-900">
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
              : product.totalStock <= (product.lowStockThreshold ?? 10)
                ? `Low·${product.totalStock}`
                : product.totalStock}
          </span>
        </div>
      </div>

      {/* Edit — always visible on touch, hover-revealed on desktop */}
      <Link
        href={routes.eCommerce.editSubProduct(productId)}
        prefetch={false}
        aria-label={`Edit ${product.product?.name || 'product'}`}
        onClick={(event) => event.stopPropagation()}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 opacity-100 transition-opacity hover:bg-red-50 hover:text-[#b20202] md:opacity-0 md:group-hover:opacity-100"
      >
        <PiPencilSimpleBold className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
