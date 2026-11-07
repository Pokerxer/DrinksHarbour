'use client';
import { useState } from 'react';
import DispatchRecovery from './local-dispatch-recovery';
import DispatchReturn from './local-dispatch-return';
import {
  type DispatchBooking,
  type DispatchOptions,
} from '@/services/local-dispatch.service';
import { formatMerchantMoney } from '@/services/merchant-order.service';
import {
  badgeClass,
  buttonClass,
  buttonDangerClass,
  fieldClass,
} from '../market-foundation/workspace';
type Props = {
  booking: DispatchBooking;
  recoveryDrivers?: DispatchOptions['drivers'];
  busy: boolean;
  perform: (path: string, payload: Record<string, unknown>) => Promise<void>;
  token?: string;
};
export default function DispatchBookingCard({
  booking,
  busy,
  perform,
  recoveryDrivers = [],
  token = '',
}: Props) {
  const [reason, setReason] = useState(''),
    [recipient, setRecipient] = useState('');
  const base = `/bookings/${booking._id}`;
  return (
    <article className="space-y-3 rounded-lg border border-muted p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={badgeClass}>{booking.state}</span>
        <span className="text-sm font-medium tabular-nums">
          {formatMerchantMoney(booking.amountMinor, booking.currency)} delivery
          allocation
        </span>
      </div>
      <p className="text-sm">
        {booking.lines.reduce((n, line) => n + line.quantity, 0)} item(s) in
        this local delivery.
      </p>
      {booking.state === 'booked' && (
        <>
          <button
            className={buttonClass}
            disabled={busy}
            onClick={() =>
              void perform(`${base}/dispatch`, {
                expectedVersion: booking.version,
              })
            }
          >
            Dispatch selected goods
          </button>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(`${base}/cancel`, { reason });
            }}
          >
            <label>
              Cancel booking reason
              <input
                className={fieldClass}
                value={reason}
                required
                minLength={5}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button className={buttonDangerClass} disabled={busy}>
              Cancel rider booking
            </button>
          </form>
        </>
      )}
      {booking.state === 'dispatched' && (
        <div className="space-y-3">
          <p className="text-sm leading-6 text-gray-600">
            Record delivery only after confirming the recipient received these
            items.
          </p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(`${base}/resolve`, {
                expectedVersion: booking.version,
                status: 'delivered',
                ...(recipient.trim()
                  ? { proofOfDelivery: { recipientName: recipient.trim() } }
                  : {}),
              });
            }}
          >
            <label>
              Recipient name
              <input
                className={fieldClass}
                value={recipient}
                maxLength={120}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </label>
            <button className={buttonClass} disabled={busy}>
              Record delivered drop
            </button>
          </form>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(`${base}/resolve`, {
                expectedVersion: booking.version,
                status: 'failed',
                failureReason: reason,
              });
            }}
          >
            <label>
              Failed drop reason
              <input
                className={fieldClass}
                value={reason}
                required
                minLength={3}
                maxLength={300}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <button className={buttonDangerClass} disabled={busy}>
              Record failed drop
            </button>
          </form>
        </div>
      )}
      <DispatchRecovery
        booking={booking}
        drivers={recoveryDrivers}
        busy={busy}
        perform={perform}
      />
      <DispatchReturn
        booking={booking}
        token={token}
        busy={busy}
        perform={perform}
      />
      {booking.events.length > 0 && (
        <ul
          className="text-sm text-gray-600 dark:text-gray-400"
          aria-label="Local delivery history"
        >
          {booking.events.map((event) => (
            <li key={event.key} className="tabular-nums">
              {event.state} · {new Date(event.at).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
