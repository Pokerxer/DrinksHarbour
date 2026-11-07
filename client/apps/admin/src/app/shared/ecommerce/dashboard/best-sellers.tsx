'use client';

// Colocated top-products widget. Rows deep-link ONLY when the payload
// carries a productSlug (server adds it additively; legacy payloads may be
// absent or '' — those rows keep the exact current look, value-only).
// RSC note: 'use client' is REQUIRED here — the component calls the
// useDashboard() context hook and must not be evaluated on the server.

import Image from 'next/image';
import WidgetCard from '@core/components/cards/widget-card';
import { Text } from 'rizzui/typography';
import { Button } from 'rizzui/button';
import { useDashboard, useDashboardMeta } from './use-dashboard';
import { routes } from '@/config/routes';
import Link from 'next/link';
import {
  PiPackageDuotone,
  PiTrophyDuotone,
  PiStorefrontDuotone,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import { formatCompactNaira as fmt } from './dashboard-format';
import { EmptyState } from './widget-parts';
import type { TopProduct } from '@/services/dashboard.service';

/**
 * Defensive local widening — the service may or may not expose productSlug
 * (serialising server agent adds it additively). Typed here WITHOUT touching
 * the service file; empty/absent slug ⇒ plain row, never a wrong link.
 */
type BestSellerWithSlug = TopProduct & { productSlug?: string };

const STATUS_COLOR: Record<string, string> = {
  in_stock:
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  low_stock:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  out_of_stock: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

const NEUTRAL_BADGE =
  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

const RANK_COLOR = ['text-amber-500', 'text-gray-400', 'text-amber-700'];

function VendorChip({ vendor }: { vendor: NonNullable<TopProduct['vendor']> }) {
  const initials = vendor.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        borderColor: vendor.color + '60',
        color: vendor.color,
        backgroundColor: vendor.color + '15',
      }}
      title={vendor.name}
    >
      {vendor.logo ? (
        <Image
          src={vendor.logo}
          alt={vendor.name}
          width={12}
          height={12}
          className="h-3 w-3 rounded-full object-cover"
        />
      ) : (
        <span
          className="flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-white"
          style={{ backgroundColor: vendor.color }}
          aria-hidden="true"
        >
          {initials[0]}
        </span>
      )}
      {vendor.name.split(' ')[0]}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex animate-pulse items-start">
      <div className="me-2 h-11 w-5 shrink-0 rounded bg-gray-100 dark:bg-gray-100/10" />
      <div className="me-3 h-11 w-11 shrink-0 rounded-lg bg-gray-200 dark:bg-gray-100/20" />
      <div className="flex w-full items-start justify-between">
        <div className="space-y-1.5">
          <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-100/20" />
          <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-100/10" />
          <div className="h-4 w-16 rounded bg-gray-100 dark:bg-gray-100/10" />
        </div>
        <div className="h-5 w-14 rounded-full bg-gray-100 dark:bg-gray-100/10" />
      </div>
    </div>
  );
}

/** Only a real, non-empty string slug earns a link — never ''. */
function productSlugOf(product: TopProduct): string | null {
  const slug = (product as BestSellerWithSlug).productSlug;
  return typeof slug === 'string' && slug.length > 0 ? slug : null;
}

export default function BestSellers({ className }: { className?: string }) {
  const data = useDashboard();
  const meta = useDashboardMeta();
  const products = data?.topProducts ?? [];
  const isLoading = !data;

  return (
    <WidgetCard
      title="Top Products"
      description={`By units sold · ${meta?.label ?? 'This month'}`}
      action={
        <Link href={routes.eCommerce.products}>
          <Button
            variant="text"
            className="whitespace-nowrap text-xs underline"
          >
            View All
          </Button>
        </Link>
      }
      descriptionClassName="mt-0.5 text-gray-500 dark:text-gray-600"
      className={className}
    >
      {isLoading ? (
        <div className="custom-scrollbar -me-2 mt-4 grid max-h-[480px] gap-4 overflow-y-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="pe-2">
              <SkeletonRow />
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<PiPackageDuotone className="h-6 w-6" aria-hidden="true" />}
          message="No sales data yet"
        />
      ) : (
        <div className="custom-scrollbar -me-2 mt-4 grid max-h-[480px] gap-3.5 overflow-y-auto">
          {products.map((product, idx) => (
            <BestSellerRow
              key={String(product.id)}
              product={product}
              idx={idx}
            />
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

function BestSellerRow({ product, idx }: { product: TopProduct; idx: number }) {
  const slug = productSlugOf(product);

  const body = (
    <>
      {/* Rank */}
      <div className="me-2 flex h-11 w-5 shrink-0 items-center justify-center">
        {idx < 3 ? (
          <PiTrophyDuotone
            className={cn('h-4 w-4', RANK_COLOR[idx])}
            aria-hidden="true"
          />
        ) : (
          <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-600">
            {idx + 1}
          </span>
        )}
        <span className="sr-only">Rank {idx + 1}</span>
      </div>

      {/* Product image */}
      <div className="me-3 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 @sm:h-12 @sm:w-12">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            width={48}
            height={48}
            className="h-full w-full object-cover"
          />
        ) : (
          <PiPackageDuotone
            className="h-5 w-5 text-gray-500 dark:text-gray-400"
            aria-hidden="true"
          />
        )}
      </div>

      {/* Info */}
      <div className="flex w-full items-start justify-between gap-2">
        <div className="min-w-0">
          <Text
            className="truncate font-lexend text-sm font-medium leading-snug text-gray-900 dark:text-gray-100"
            title={product.name}
          >
            {slug ? (
              <span className="group-hover:underline underline-offset-2">
                {product.name}
              </span>
            ) : (
              product.name
            )}
          </Text>
          <Text className="text-xs tabular-nums text-gray-500 dark:text-gray-600">
            {product.sold.toLocaleString()} sold ·{' '}
            {fmt(product.revenue)}
            {product.margin !== null && (
              <span className="ms-1.5 text-gray-500 dark:text-gray-600">
                · {product.margin}% margin
              </span>
            )}
          </Text>
          {/* Vendor chip */}
          <div className="mt-1">
            {product.vendor ? (
              <VendorChip vendor={product.vendor} />
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-600">
                <PiStorefrontDuotone
                  className="h-3 w-3"
                  aria-hidden="true"
                />{' '}
                Platform
              </span>
            )}
          </div>
        </div>

        {/* Stock badge */}
        <span
          className={cn(
            'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
            STATUS_COLOR[product.stockStatus] ?? NEUTRAL_BADGE
          )}
          title={`${product.stock} left`}
        >
          {product.stock} left
        </span>
      </div>
    </>
  );

  // Slug present → the whole row is a 44px+ deep link (real pinned route,
  // visible focus ring, hover affordance). Legacy payload → identical plain
  // row; never link a product we can't identify.
  return slug ? (
    <Link
      href={routes.eCommerce.productDetails(slug)}
      className="group flex items-start rounded-lg pe-2 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-gray-100/10"
    >
      {body}
    </Link>
  ) : (
    <div className="flex items-start pe-2">{body}</div>
  );
}
