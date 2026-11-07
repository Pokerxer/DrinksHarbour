'use client';
import { useState } from 'react';
import type {
  DispatchBooking,
  DispatchOptions,
} from '@/services/local-dispatch.service';
import { buttonClass, fieldClass } from '../market-foundation/workspace';
export default function DispatchRecovery({
  booking,
  drivers,
  busy,
  perform,
}: {
  booking: DispatchBooking;
  drivers: DispatchOptions['drivers'];
  busy: boolean;
  perform: (path: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [reason, setReason] = useState(''),
    [driver, setDriver] = useState('');
  if (!['failed', 'returning', 'returned'].includes(booking.state)) return null;
  if (booking.state === 'returned')
    return (
      <p className="text-sm">
        Goods physically received into quarantine. Stock disposition and any
        refund require separate review.
      </p>
    );
  const act = (action: string) =>
    void perform(`/bookings/${booking._id}/recover`, {
      action,
      expectedVersion: booking.version,
      reason,
      ...(action === 'reattempt' ? { driverId: driver } : {}),
    });
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {booking.state === 'failed'
          ? 'Goods remain shipped. Reattempt uses the original goods and delivery allocation.'
          : 'Return requested; no stock or money is restored. Confirm receipt only after the original goods arrive at this order’s original location.'}
      </p>
      <label className="block">
        Recovery reason
        <input
          className={fieldClass}
          value={reason}
          minLength={5}
          maxLength={300}
          required
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      {booking.state === 'failed' ? (
        <>
          <label className="block">
            Retry rider
            <select
              className={fieldClass}
              value={driver}
              onChange={(e) => setDriver(e.target.value)}
            >
              <option value="">Choose available own rider</option>
              {drivers.map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} · {d.vehicleType} · {d.capacityKg} kg
                </option>
              ))}
            </select>
          </label>
          <button
            className={buttonClass}
            disabled={busy || reason.trim().length < 5 || !driver}
            onClick={() => act('reattempt')}
          >
            Reattempt original delivery
          </button>
          <button
            className={buttonClass}
            disabled={busy || reason.trim().length < 5}
            onClick={() => act('return')}
          >
            Request goods return
          </button>
        </>
      ) : (
        <button
          className={buttonClass}
          disabled={busy || reason.trim().length < 5}
          onClick={() => act('receive_return')}
        >
          Confirm receipt into quarantine
        </button>
      )}
    </div>
  );
}
