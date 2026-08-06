'use client';

import { routes } from '@/config/routes';
import { Skeleton } from '@core/ui/skeleton';
import cn from '@core/utils/class-names';
import Link from 'next/link';
import { useState } from 'react';
import {
  PiCaretDownDuotone,
  PiCoinsDuotone,
  PiIdentificationCardDuotone,
  PiReceiptDuotone,
  PiUserCircleDuotone,
  PiWalletDuotone,
} from 'react-icons/pi';
import { Text, Title } from 'rizzui';
import { InboxErrorState } from './inbox-state-views';
import { useCustomerContext } from './use-mail';
import type { CustomerOrder } from './types';

/**
 * Naira, matching the orders module's own formatter. `en-NG` with no decimals:
 * every price in this system is a whole number of naira, and "₦125,400.00" in a
 * dense side panel is noise.
 */
function formatMoney(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency || 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDay(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Every surface carries a dark variant. A single light-only chip in this panel
 * reads as a rendering fault against the dark shell, not as a status.
 */
const STATUS_TONES: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  shipped: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  partially_shipped:
    'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  processing: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  confirmed: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-200/50 dark:text-gray-600',
  hold: 'bg-gray-100 text-gray-700 dark:bg-gray-200/50 dark:text-gray-600',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  refunded: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
};

const PAYMENT_TONES: Record<string, string> = {
  paid: 'text-green-700 dark:text-green-400',
  refunded: 'text-red-700 dark:text-red-400',
  failed: 'text-red-700 dark:text-red-400',
};

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'rounded px-1.5 py-0.5 text-xs font-medium capitalize',
        STATUS_TONES[status] ??
          'bg-gray-100 text-gray-700 dark:bg-gray-200/50 dark:text-gray-600'
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function OrderRow({ order }: { order: CustomerOrder }) {
  const day = formatDay(order.date);
  return (
    <Link
      href={routes.eCommerce.orderDetails(order.id)}
      className="flex items-center justify-between gap-3 rounded-md border border-muted px-3 py-2 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-100/40"
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-gray-800">
          {order.orderNumber || `Order ${order.id.slice(-6)}`}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
          {day && <span>{day}</span>}
          {order.paymentStatus && (
            <span
              className={cn(
                'capitalize',
                PAYMENT_TONES[order.paymentStatus] ?? 'text-gray-400'
              )}
            >
              {order.paymentStatus}
            </span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StatusChip status={order.status} />
        <span className="text-sm font-semibold text-gray-800">
          {formatMoney(order.total, order.currency)}
        </span>
      </span>
    </Link>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
      <span className="min-w-0">
        <span className="block text-xs text-gray-400">{label}</span>
        <span className="block truncate text-sm text-gray-700">{value}</span>
      </span>
    </div>
  );
}

interface Props {
  /** The sender's address. Null when the message carries no usable From. */
  email: string | null;
  className?: string;
}

/**
 * Who the sender is, as a DrinksHarbour customer.
 *
 * The three outcomes are kept visually distinct on purpose, because two of them
 * are routinely confused in support tooling:
 *   - a stranger  → "No customer record", plain and unalarming
 *   - a customer  → identity, stored value, and their last orders
 *   - a failure   → a retryable alert card, never an empty panel
 */
export default function CustomerContextPanel({ email, className }: Props) {
  const [open, setOpen] = useState(true);
  const context = useCustomerContext(email);

  if (!email) return null;

  const data = context.data;
  const customer = data?.customer ?? null;
  const orders = data?.orders ?? [];

  const summary = context.loading
    ? 'Looking up…'
    : context.error
      ? 'Lookup failed'
      : customer
        ? customer.name
        : orders.length
          ? `Guest · ${orders.length} order${orders.length > 1 ? 's' : ''}`
          : 'No customer record';

  return (
    <section
      className={cn(
        'overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-100/40"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PiUserCircleDuotone className="h-5 w-5 shrink-0 text-gray-400" />
          <Title as="h4" className="text-sm font-semibold text-gray-900">
            Customer
          </Title>
          <span className="min-w-0 truncate text-xs text-gray-400">{summary}</span>
        </span>
        <PiCaretDownDuotone
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="border-t border-muted px-4 py-4">
          {context.loading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-1/2 rounded" />
              <Skeleton className="h-3 w-1/3 rounded" />
              <Skeleton className="h-10 w-full rounded" />
            </div>
          )}

          {/* A failed lookup is an error, not an absent customer. */}
          {!context.loading && context.error && (
            <InboxErrorState
              message={context.error}
              onRetry={context.reload}
              className="px-0 py-4"
            />
          )}

          {!context.loading && !context.error && !customer && !orders.length && (
            <Text className="text-sm text-gray-500">
              No customer record for {email}.
            </Text>
          )}

          {!context.loading && !context.error && (customer || orders.length > 0) && (
            <div className="space-y-4">
              {customer ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Fact
                    icon={PiIdentificationCardDuotone}
                    label="Name"
                    value={customer.name}
                  />
                  {customer.phone && (
                    <Fact
                      icon={PiIdentificationCardDuotone}
                      label="Phone"
                      value={customer.phone}
                    />
                  )}
                  <Fact
                    icon={PiUserCircleDuotone}
                    label="Customer since"
                    value={formatDay(customer.customerSince) ?? 'Unknown'}
                  />
                  {data?.wallet && (
                    <>
                      <Fact
                        icon={PiWalletDuotone}
                        label="Wallet"
                        value={formatMoney(data.wallet.platformBalance)}
                      />
                      <Fact
                        icon={PiCoinsDuotone}
                        label="Corks & Points"
                        value={`${data.wallet.loyaltyPoints.toLocaleString()}${
                          data.wallet.loyaltyTier
                            ? ` · ${data.wallet.loyaltyTier}`
                            : ''
                        }`}
                      />
                    </>
                  )}
                </div>
              ) : (
                <Text className="text-sm text-gray-500">
                  No account for {email} — these orders were placed as a guest.
                </Text>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">
                    <PiReceiptDuotone className="h-4 w-4" />
                    Recent orders
                  </span>
                  {data && data.orderCount > orders.length && (
                    <span className="text-xs text-gray-400">
                      {orders.length} of {data.orderCount}
                    </span>
                  )}
                </div>
                {orders.length ? (
                  <div className="space-y-1.5">
                    {orders.map((order) => (
                      <OrderRow key={order.id} order={order} />
                    ))}
                  </div>
                ) : (
                  <Text className="text-sm text-gray-500">
                    No orders on this account yet.
                  </Text>
                )}
              </div>

              {customer?.contactKey && (
                <Link
                  href={routes.contacts.detail(customer.contactKey)}
                  className="inline-flex items-center rounded-md border border-muted px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-gray-100/40"
                >
                  Open contact record
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
