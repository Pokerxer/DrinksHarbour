'use client';
import type { CarrierBooking } from '@/services/carrier.service';
import { buttonClass } from '../market-foundation/workspace';
type Props = { bookings: CarrierBooking[]; platform: boolean; busy: boolean;
  onAction: (path: string, payload: Record<string, unknown>, keyed?: boolean) => Promise<boolean> };
export default function CarrierBookings({ bookings, platform, busy, onAction }: Props) {
  return bookings.map(b => <article key={b._id} className="space-y-2 rounded border p-3">
    <p>Carrier responsibility: {b.state}; provider observation: {b.providerStatus || 'Awaiting confirmation'}.</p>
    {['uncertain', 'submitting'].includes(b.state) ? <>
      <p>Outcome uncertain. Keep the original responsibility; do not create another shipment.</p>
      {platform && <button className={buttonClass} disabled={busy} onClick={() => void onAction(`/bookings/${b._id}/reconcile`, {}, false)}>Reconcile original carrier outcome</button>}
    </> : <>
      <button className={buttonClass} disabled={busy} onClick={() => void onAction(`/bookings/${b._id}/refresh`, {}, false)}>Refresh provider observation</button>
      {b.state === 'booked' && <button className={buttonClass} disabled={busy} onClick={() => void onAction(`/bookings/${b._id}/cancel`, {})}>Request scheduled carrier cancellation</button>}
    </>}
  </article>);
}
