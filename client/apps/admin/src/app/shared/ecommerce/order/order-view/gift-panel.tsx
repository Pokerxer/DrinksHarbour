'use client';

import { WidgetCard, Field } from './widgets';
import { formatRequestedDeliveryDate, getGift } from './gift';
import type { Order } from '@/services/order.service';

/** Read-only staff view of the customer's gift block — nothing here is
 *  editable in v1. The requested delivery date is a plan the team confirms,
 *  never a guaranteed date, and the copy says so. The gift note is customer
 *  content rendered as plain text (React escaping — no HTML injection). */
export default function GiftPanel({ order }: { order: Order }) {
  const gift = getGift(order);
  if (!gift) return null;
  return (
    <WidgetCard title="Gift" childrenWrapperClass="py-5 @5xl:py-6">
      <div className="space-y-2.5">
        <Field label="From" value={gift.from} />
        <Field label="To" value={gift.to} />
        {gift.recipientPhone && <Field label="Recipient phone" value={gift.recipientPhone} />}
        {gift.message && (
          <Field
            label="Message"
            value={
              <span className="whitespace-pre-wrap break-words">
                {gift.message}
              </span>
            }
          />
        )}
        <Field
          label="Requested Delivery Date"
          value={
            <span className="whitespace-normal">
              {`${formatRequestedDeliveryDate(gift.requestedDeliveryDate)} — requested — confirm the exact window with the recipient/customer`}
            </span>
          }
        />
        <Field
          label="Packaging"
          value={
            gift.packagingRequested
              ? 'Requested — confirm box/hamper in writing'
              : '—'
          }
        />
      </div>
    </WidgetCard>
  );
}
