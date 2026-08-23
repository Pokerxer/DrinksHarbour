import cn from '@core/utils/class-names';
import {
  PiCreditCardBold,
  PiBankBold,
  PiDeviceMobileBold,
  PiHandCoinsBold,
  PiWalletBold,
  PiGiftBold,
  PiGlobeBold,
  PiStorefrontBold,
} from 'react-icons/pi';
import type { Order } from '@/services/order.service';

// ── Formatters ────────────────────────────────────────────────────────────────

export const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

export const fmtDate = (d?: string) => {
  if (!d) return '—';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export function humanize(v: string) {
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Status / payment / method / source metadata ──────────────────────────────

/** Status keys mirror the Order model enum — every one of them needs a config
 *  entry, otherwise the badge falls back to a raw grey string (which is what
 *  `confirmed`, `hold` and `partially_shipped` orders used to render as). */
export const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; badge: string }
> = {
  pending: {
    label: 'Pending',
    dot: 'bg-orange-400',
    badge:
      'bg-orange-500/10 text-orange-600 ring-orange-500/20 dark:text-orange-400',
  },
  confirmed: {
    label: 'Confirmed',
    dot: 'bg-sky-400',
    badge: 'bg-sky-500/10 text-sky-600 ring-sky-500/20 dark:text-sky-400',
  },
  hold: {
    label: 'On Hold',
    dot: 'bg-gray-400',
    badge: 'bg-gray-500/10 text-gray-600 ring-gray-500/20 dark:text-gray-400',
  },
  processing: {
    label: 'Processing',
    dot: 'bg-blue-400',
    badge: 'bg-blue-500/10 text-blue-600 ring-blue-500/20 dark:text-blue-400',
  },
  partially_shipped: {
    label: 'Part. Shipped',
    dot: 'bg-purple-400',
    badge:
      'bg-purple-500/10 text-purple-600 ring-purple-500/20 dark:text-purple-400',
  },
  shipped: {
    label: 'Shipped',
    dot: 'bg-indigo-400',
    badge:
      'bg-indigo-500/10 text-indigo-600 ring-indigo-500/20 dark:text-indigo-400',
  },
  delivered: {
    label: 'Delivered',
    dot: 'bg-green-500',
    badge:
      'bg-green-500/10 text-green-600 ring-green-500/20 dark:text-green-400',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-red-400',
    badge: 'bg-red-500/10 text-red-600 ring-red-500/20 dark:text-red-400',
  },
  refunded: {
    label: 'Refunded',
    dot: 'bg-gray-400',
    badge: 'bg-gray-500/10 text-gray-600 ring-gray-500/20 dark:text-gray-400',
  },
};

export const PAY_CONFIG: Record<string, { label: string; badge: string }> = {
  pending: {
    label: 'Unpaid',
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  paid: {
    label: 'Paid',
    badge: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  failed: {
    label: 'Failed',
    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  refunded: {
    label: 'Refunded',
    badge: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
  },
  partially_refunded: {
    label: 'Part. Refunded',
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
};

/** Mirrors the Order.paymentMethod enum (server/utils/paymentMethods.js) and the
 *  METHOD_META used on the order detail page, so a method reads the same in both
 *  places. The list previously showed payment *status* only, with no way to see
 *  or filter on how an order was actually paid. */
export const METHOD_CONFIG: Record<
  string,
  { label: string; short: string; Icon: React.ElementType; badge: string }
> = {
  card: {
    label: 'Card Payment',
    short: 'Card',
    Icon: PiCreditCardBold,
    badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  },
  bank_transfer: {
    label: 'Bank Transfer',
    short: 'Transfer',
    Icon: PiBankBold,
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  mobile_money: {
    label: 'Mobile Money',
    short: 'Mobile',
    Icon: PiDeviceMobileBold,
    badge: 'bg-green-500/10 text-green-600 dark:text-green-400',
  },
  cash_on_delivery: {
    label: 'Cash on Delivery',
    short: 'COD',
    Icon: PiHandCoinsBold,
    badge: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  },
  cash: {
    label: 'Cash',
    short: 'Cash',
    Icon: PiHandCoinsBold,
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  wallet: {
    label: 'DH Wallet',
    short: 'Wallet',
    Icon: PiWalletBold,
    badge: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  },
  gift_card: {
    label: 'Gift Card',
    short: 'Gift',
    Icon: PiGiftBold,
    badge: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  },
  split: {
    label: 'Split Payment',
    short: 'Split',
    Icon: PiCreditCardBold,
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  },
};

export const SOURCE_CONFIG: Record<
  string,
  { label: string; Icon: React.ElementType }
> = {
  web: { label: 'Web', Icon: PiGlobeBold },
  app: { label: 'App', Icon: PiGlobeBold },
  pos: { label: 'POS', Icon: PiStorefrontBold },
  manual: { label: 'Manual', Icon: PiStorefrontBold },
};

// ── Badges ────────────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        cfg?.badge ??
          'bg-gray-500/10 text-gray-600 ring-gray-500/20 dark:text-gray-400'
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', cfg?.dot ?? 'bg-gray-400')}
      />
      {cfg?.label ?? humanize(status)}
    </span>
  );
}

export function PayBadge({ status }: { status: string }) {
  const cfg = PAY_CONFIG[status];
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium',
        cfg?.badge ?? 'bg-gray-500/10 text-gray-600 dark:text-gray-400'
      )}
    >
      {cfg?.label ?? humanize(status)}
    </span>
  );
}

export function MethodBadge({ method }: { method?: string }) {
  if (!method) return <span className="text-xs text-gray-300">—</span>;
  const meta = METHOD_CONFIG[method];
  if (!meta) {
    // An unmapped value is real data, not a blank — show it rather than hide it.
    return (
      <span className="inline-flex items-center rounded-md bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-400">
        {method.replace(/_/g, ' ')}
      </span>
    );
  }
  const { Icon } = meta;
  return (
    <span
      title={meta.label}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium',
        meta.badge
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {meta.short}
    </span>
  );
}

// ── Customer resolution ───────────────────────────────────────────────────────

/** Customer identity lives in three different places depending on where the
 *  order came from: shippingAddress (web checkout), paymentDetails.customer
 *  (POS till) or the linked user account (signed-in checkout). */
export function customerOf(order: Order) {
  const addr = order.shippingAddress;
  if (addr?.fullName || addr?.email) {
    return {
      name: addr.fullName || '—',
      contact: addr.email || addr.phone || '',
    };
  }
  const pos = order.paymentDetails?.customer;
  if (pos?.firstName || pos?.phone) {
    return {
      name:
        [pos.firstName, pos.lastName].filter(Boolean).join(' ') ||
        'Walk-in customer',
      contact: pos.phone || '',
    };
  }
  if (order.user) {
    return {
      name:
        `${order.user.firstName ?? ''} ${order.user.lastName ?? ''}`.trim() ||
        '—',
      contact: order.user.email || '',
    };
  }
  return { name: '—', contact: '' };
}
