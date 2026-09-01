'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import cn from '@core/utils/class-names';
import {
  PiShoppingCartBold,
  PiPulseBold,
  PiHourglassBold,
  PiTrashBold,
  PiTrayBold,
  PiUserPlusBold,
  PiCurrencyNgnBold,
} from 'react-icons/pi';
import { formatCurrency } from '../order/order-view/format';
import type {
  AdminCartListResult,
  AdminCartSummary,
  AdminNewCustomerSummary,
  CartBucket,
} from '@/services/adminCart.service';

type Mode = 'carts' | 'newCustomers';

const CARD_COLORS: Record<
  string,
  { grad: string; icon: string; ring: string; text: string }
> = {
  blue: {
    grad: 'from-blue-500/10 to-blue-500/5',
    icon: 'bg-blue-500',
    ring: 'ring-blue-400/50',
    text: 'text-blue-600 dark:text-blue-400',
  },
  green: {
    grad: 'from-green-500/10 to-green-500/5',
    icon: 'bg-green-500',
    ring: 'ring-green-400/50',
    text: 'text-green-600 dark:text-green-400',
  },
  orange: {
    grad: 'from-amber-500/10 to-amber-500/5',
    icon: 'bg-amber-500',
    ring: 'ring-amber-400/50',
    text: 'text-amber-600 dark:text-amber-400',
  },
  red: {
    grad: 'from-red-500/10 to-red-500/5',
    icon: 'bg-red-500',
    ring: 'ring-red-400/50',
    text: 'text-red-600 dark:text-red-400',
  },
  indigo: {
    grad: 'from-indigo-500/10 to-indigo-500/5',
    icon: 'bg-indigo-500',
    ring: 'ring-indigo-400/50',
    text: 'text-indigo-600 dark:text-indigo-400',
  },
  slate: {
    grad: 'from-slate-500/10 to-slate-500/5',
    icon: 'bg-slate-600',
    ring: 'ring-slate-400/50',
    text: 'text-slate-600 dark:text-slate-400',
  },
};

const FILTER_CARDS: {
  id: '' | CartBucket | 'new';
  label: string;
  icon: typeof PiShoppingCartBold;
  color: keyof typeof CARD_COLORS;
}[] = [
  { id: '', label: 'All Carts', icon: PiShoppingCartBold, color: 'blue' },
  { id: 'active', label: 'Active', icon: PiPulseBold, color: 'green' },
  { id: 'at_risk', label: 'At Risk', icon: PiHourglassBold, color: 'orange' },
  { id: 'abandoned', label: 'Abandoned', icon: PiTrashBold, color: 'red' },
  {
    id: 'new',
    label: 'New customers in window',
    icon: PiUserPlusBold,
    color: 'indigo',
  },
];

function StatCardSkeleton({ className = 'h-8 w-12' }: { className?: string }) {
  return <div className={cn('animate-pulse rounded bg-gray-200', className)} />;
}

/** A read-only tile — no filter behaviour, just a number and a label. */
function Card({
  label,
  icon: Icon,
  color,
  value,
  loading,
}: {
  label: string;
  icon: typeof PiShoppingCartBold;
  color: string;
  value?: ReactNode;
  loading: boolean;
}) {
  const col = CARD_COLORS[color];
  return (
    <div
      className={cn('relative rounded-2xl bg-gradient-to-br p-4', col.grad)}
    >
      <div
        className={cn(
          'mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white',
          col.icon
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      {loading ? (
        <StatCardSkeleton />
      ) : (
        <p className="text-xl font-black text-gray-900">{value}</p>
      )}
      <p className={cn('mt-0.5 text-xs font-semibold opacity-80', col.text)}>
        {label}
      </p>
    </div>
  );
}

/**
 * The four bucket filters plus the "New customers" conversion card (cart mode),
 * or the conversion breakdown (new-customer mode), and a read-only value tile.
 *
 * IMPORTANT: in cart mode every number comes from `summary`, which the server
 * derives from the rows it just returned — i.e. THIS PAGE, not the whole
 * collection. The value tile therefore says "on this page".
 *
 * The one deliberate exception is `headlineShoppers`: a window-wide count the
 * server computes with its own query, shown only on the "New customers" card
 * and labelled "in window" so it cannot be misread as a page count.
 */
export default function CartStatsCards({
  summary,
  mode,
  active,
  headlineShoppers,
  loading,
  onFilter,
  onToggleNew,
}: {
  summary: AdminCartListResult['summary'] | null;
  mode: Mode;
  active: '' | CartBucket;
  headlineShoppers: number | null;
  loading: boolean;
  onFilter: (b: '' | CartBucket) => void;
  onToggleNew: () => void;
}) {
  const cartSummary =
    summary && mode === 'carts' ? (summary as AdminCartSummary) : null;
  const convSummary =
    summary && mode === 'newCustomers'
      ? (summary as AdminNewCustomerSummary)
      : null;

  return (
    <div
      className={cn(
        'mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3',
        mode === 'carts' ? 'lg:grid-cols-6' : 'lg:grid-cols-4'
      )}
    >
      {mode === 'carts' ? (
        <>
          {FILTER_CARDS.map((c, i) => {
            const col = CARD_COLORS[c.color];
            const Icon = c.icon;
            const isNew = c.id === 'new';
            const isActive = !isNew && active === c.id;
            const count = isNew
              ? (headlineShoppers ?? 0)
              : cartSummary
                ? c.id === ''
                  ? cartSummary.counts.all
                  : cartSummary.counts[c.id as CartBucket]
                : 0;
            return (
              <motion.button
                key={c.id || 'all'}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  isNew ? onToggleNew() : onFilter(c.id as '' | CartBucket)
                }
                aria-pressed={isActive}
                className={cn(
                  'relative rounded-2xl bg-gradient-to-br p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  col.grad,
                  isActive && `ring-4 ${col.ring}`
                )}
              >
                <div
                  className={cn(
                    'mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-white',
                    col.icon
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                {loading ? (
                  <StatCardSkeleton />
                ) : (
                  <p className="text-2xl font-black text-gray-900">{count}</p>
                )}
                <p
                  className={cn(
                    'mt-0.5 text-xs font-semibold opacity-80',
                    col.text
                  )}
                >
                  {c.label}
                </p>
              </motion.button>
            );
          })}

          <Card
            label="Value on this page"
            icon={PiCurrencyNgnBold}
            color="slate"
            loading={loading}
            value={formatCurrency(cartSummary?.totalValue ?? 0)}
          />
        </>
      ) : (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={onToggleNew}
            aria-pressed
            title="Back to live carts"
            className={cn(
              'relative rounded-2xl bg-gradient-to-br p-4 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              CARD_COLORS.indigo.grad,
              `ring-4 ${CARD_COLORS.indigo.ring}`
            )}
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500 text-white">
              <PiUserPlusBold className="h-5 w-5" />
            </div>
            {loading ? (
              <StatCardSkeleton />
            ) : (
              <p className="text-2xl font-black text-gray-900">
                {headlineShoppers ?? convSummary?.shoppers ?? 0}
              </p>
            )}
            <p className="mt-0.5 text-xs font-semibold text-indigo-600 opacity-80 dark:text-indigo-400">
              New customers in window
            </p>
          </motion.button>

          <Card
            label="With cart"
            icon={PiShoppingCartBold}
            color="green"
            loading={loading}
            value={convSummary?.withCart ?? 0}
          />
          <Card
            label="No cart yet"
            icon={PiTrayBold}
            color="orange"
            loading={loading}
            value={convSummary?.noCart ?? 0}
          />
          <Card
            label="Value of their carts"
            icon={PiCurrencyNgnBold}
            color="slate"
            loading={loading}
            value={formatCurrency(convSummary?.totalValue ?? 0)}
          />
        </>
      )}
    </div>
  );
}