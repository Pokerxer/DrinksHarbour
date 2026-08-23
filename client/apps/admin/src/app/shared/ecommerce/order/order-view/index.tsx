'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PiWarningCircleBold,
  PiPrinterBold,
  PiStorefrontBold,
  PiMapPinBold,
  PiUserBold,
  PiSealCheckBold,
  PiProhibitBold,
} from 'react-icons/pi';
import { Title, Text } from 'rizzui';
import {
  orderService,
  type Order,
} from '@/services/order.service';
import { parseDate, shortDate, longDate, humanize, formatCurrency } from './format';
import { resolveCustomer } from './customer-info';
import { useOrderSession } from './permissions';
import StatusStepper from './status-stepper';
import PaymentPanel from './payment-panel';
import RefundHistory from './refund-history';
import OrderItemsTable from './order-items-table';
import { WidgetCard, Field, Row, PaymentBadge, LoadingSkeleton } from './widgets';

/**
 * Full order detail: summary bar → items/payment/refunds (left) and
 * status/customer/addresses/info cards (right). Data normally arrives
 * server-rendered via `initialOrder`; the fetch effect only runs when the
 * component is mounted without one (e.g. deep-linked after a session change).
 */
export default function OrderView({
  orderId,
  initialOrder,
}: {
  orderId: string;
  initialOrder?: Order | null;
}) {
  const router = useRouter();
  const { token, status: sessionStatus } = useOrderSession();
  const [order, setOrder] = useState<Order | null>(initialOrder ?? null);
  const [loading, setLoading] = useState(!initialOrder);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialOrder) return; // server render already supplied the data
    if (sessionStatus === 'loading') return;
    if (!token || !orderId) {
      setLoading(false);
      setError('You are not signed in.');
      return;
    }
    let cancelled = false;
    setLoading(true);
    orderService
      .getOrder(token, orderId)
      .then((o) => !cancelled && setOrder(o))
      .catch(
        (e: any) =>
          !cancelled && setError(e?.message ?? 'Could not load this order.')
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [token, orderId, initialOrder, sessionStatus]);

  if (loading) return <LoadingSkeleton />;

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <PiWarningCircleBold className="mb-3 h-12 w-12 text-red-500" />
        <Title as="h3" className="mb-1 text-lg font-semibold">
          Order not found
        </Title>
        <Text className="text-gray-500">
          {error ?? 'Could not load this order.'}
        </Text>
        <button
          type="button"
          onClick={() => router.push('/ecommerce/orders')}
          className="mt-5 rounded-xl border border-muted px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary"
        >
          Back to orders
        </button>
      </div>
    );
  }

  const addr = order.shippingAddress;
  const billing = order.billingAddress;
  const customer = resolveCustomer(order);
  const ship = order.shippingInfo;
  const isPOS = order.source === 'pos' || Boolean(order.receiptNumber);
  const placedAt = parseDate(order.placedAt) ?? parseDate(order.createdAt);

  const eta =
    ship?.daysMin != null && ship?.daysMax != null
      ? ship.daysMin === ship.daysMax
        ? `${ship.daysMin} day${ship.daysMin === 1 ? '' : 's'}`
        : `${ship.daysMin}–${ship.daysMax} days`
      : null;

  return (
    <div className="@container">
      {order.isVoided && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3">
          <PiProhibitBold className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div>
            <p className="text-sm font-semibold text-red-600">
              This order was voided
            </p>
            <p className="text-xs text-gray-500">
              {[shortDate(order.voidedAt), order.voidReason]
                .filter(Boolean)
                .join(' · ') || 'No reason recorded.'}
            </p>
          </div>
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap items-center justify-center border-b border-t border-muted py-4 font-medium text-gray-700 @5xl:justify-start">
        <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
          {placedAt
            ? `${longDate(placedAt.toISOString())} at ${placedAt.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`
            : 'Date unknown'}
        </span>
        <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
          {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
        </span>
        <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
          Total {formatCurrency(order.totalAmount, order.currency)}
        </span>
        {isPOS && (
          <span className="my-2 border-e border-muted px-5 py-0.5 first:ps-0 last:border-e-0">
            <span className="inline-flex items-center gap-1.5 text-sm">
              <PiStorefrontBold className="h-4 w-4 text-gray-400" />
              POS{order.receiptNumber ? ` · ${order.receiptNumber}` : ''}
            </span>
          </span>
        )}
        <span className="my-2 ms-2">
          <PaymentBadge status={order.paymentStatus} />
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="my-2 ms-auto inline-flex items-center gap-1.5 rounded-lg border border-muted px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:border-primary hover:text-gray-900 print:hidden"
        >
          <PiPrinterBold className="h-4 w-4" /> Print
        </button>
      </div>

      <div className="items-start pt-10 @5xl:grid @5xl:grid-cols-12 @5xl:gap-7 @6xl:grid-cols-10 @7xl:gap-10">
        {/* Left column */}
        <div className="space-y-7 @5xl:col-span-8 @5xl:space-y-10 @6xl:col-span-7">
          <OrderItemsTable order={order} />

          <div>
            <Title
              as="h3"
              className="mb-3.5 text-base font-semibold @5xl:mb-5 @7xl:text-lg"
            >
              Payment
            </Title>
            <PaymentPanel order={order} onUpdate={setOrder} />
          </div>

          <RefundHistory order={order} />
        </div>

        {/* Right column */}
        <div className="space-y-7 pt-8 @container @5xl:col-span-4 @5xl:space-y-10 @5xl:pt-0 @6xl:col-span-3">
          <WidgetCard title="Order Status" childrenWrapperClass="p-5 @5xl:p-6">
            <StatusStepper order={order} onUpdate={setOrder} />
          </WidgetCard>

          <WidgetCard
            title="Customer Details"
            childrenWrapperClass="py-5 @5xl:py-8"
          >
            <div className="space-y-2.5">
              <Field label="Name" value={customer.name} />
              <Field label="Email" value={customer.email || undefined} />
              <Field label="Phone" value={customer.phone || undefined} />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {order.user && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                    <PiUserBold className="h-3 w-3" /> Registered customer
                  </span>
                )}
                {customer.kind === 'pos' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                    <PiStorefrontBold className="h-3 w-3" /> In-store
                  </span>
                )}
                {order.ageVerifiedAtOrderTime && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                    <PiSealCheckBold className="h-3 w-3" /> Age verified
                  </span>
                )}
              </div>
            </div>
          </WidgetCard>

          {addr && (addr.addressLine1 || addr.city) && (
            <WidgetCard
              title="Shipping Address"
              childrenWrapperClass="py-5 @5xl:py-6"
            >
              <div className="space-y-2.5">
                <Field
                  label="Address"
                  value={[addr.addressLine1, addr.addressLine2]
                    .filter(Boolean)
                    .join(', ')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="City" value={addr.city} />
                  <Field label="State" value={addr.state} />
                  <Field label="Postal Code" value={addr.postalCode} />
                  <Field label="Country" value={addr.country} />
                </div>
                <Field label="Landmark" value={addr.landmark} />
                <Field
                  label="Instructions"
                  value={addr.additionalInstructions}
                />

                {(order.shippingMethod ||
                  ship?.zoneLabel ||
                  eta ||
                  ship?.distanceKm != null) && (
                  <div className="space-y-2.5 border-t border-muted pt-2.5">
                    <Field
                      label="Shipping Method"
                      value={
                        order.shippingMethod
                          ? humanize(order.shippingMethod)
                          : undefined
                      }
                    />
                    <Field
                      label="Delivery Zone"
                      value={ship?.zoneLabel ?? undefined}
                    />
                    <Field label="Est. Delivery" value={eta ?? undefined} />
                    <Field
                      label="Distance"
                      value={
                        ship?.distanceKm != null
                          ? `${ship.distanceKm.toFixed(1)} km${ship.stops ? ` · ${ship.stops} stop${ship.stops === 1 ? '' : 's'}` : ''}`
                          : undefined
                      }
                    />
                    {ship?.isFree && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-medium text-green-600 dark:text-green-400">
                        Free delivery
                      </span>
                    )}
                    {addr.coordinates?.latitude != null &&
                      addr.coordinates?.longitude != null && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${addr.coordinates.latitude},${addr.coordinates.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400 print:hidden"
                        >
                          <PiMapPinBold className="h-3.5 w-3.5" /> View on map
                        </a>
                      )}
                  </div>
                )}
              </div>
            </WidgetCard>
          )}

          {billing && (billing.addressLine1 || billing.city) && (
            <WidgetCard
              title="Billing Address"
              childrenWrapperClass="py-5 @5xl:py-6"
            >
              <div className="space-y-2.5">
                <Field label="Name" value={billing.fullName} />
                <Field
                  label="Address"
                  value={[billing.addressLine1, billing.addressLine2]
                    .filter(Boolean)
                    .join(', ')}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="City" value={billing.city} />
                  <Field label="State" value={billing.state} />
                </div>
              </div>
            </WidgetCard>
          )}

          <WidgetCard title="Order Info" childrenWrapperClass="py-5 space-y-2">
            <Row
              label="Order #"
              value={<span className="font-mono">{order.orderNumber}</span>}
            />
            {order.receiptNumber && (
              <Row
                label="Receipt #"
                value={<span className="font-mono">{order.receiptNumber}</span>}
              />
            )}
            <Row label="Source" value={humanize(order.source ?? 'web')} />
            <Row
              label="Placed"
              value={
                longDate(order.placedAt) ?? longDate(order.createdAt) ?? '—'
              }
            />
            <Row label="Currency" value={order.currency} />
            {order.posStaff && (
              <Row
                label="Cashier"
                value={
                  order.posStaff.posName ||
                  `${order.posStaff.firstName ?? ''} ${order.posStaff.lastName ?? ''}`.trim() ||
                  order.posStaff.email
                }
              />
            )}
            {order.appliedPricelist?.pricelistName && (
              <Row
                label="Pricelist"
                value={order.appliedPricelist.pricelistName}
              />
            )}
          </WidgetCard>
        </div>
      </div>
    </div>
  );
}
