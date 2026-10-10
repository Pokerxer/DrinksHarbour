import type { StockTransfer } from '@/services/stockTransfer.service';
import { fmtCur } from './purchases-analytics-helpers';

type Actor = string | { name?: string } | null | undefined;
type Event = {
  key: string;
  label: string;
  date?: string;
  user?: Actor;
  color: string;
  detail?: string;
};

export default function TransferHistory({ transfer: t }: { transfer: StockTransfer }) {
  const events: Event[] = [
    {
      key: 'created',
      label: 'Draft created',
      date: t.createdAt,
      user: t.createdBy,
      color: 'bg-gray-400',
    },
  ];
  const add = (
    key: string,
    label: string,
    date: string | undefined,
    user: Actor,
    color: string,
  ) => {
    if (date) events.push({ key, label, date, user, color });
  };
  add('approved', 'Approved', t.approvedAt, t.approvedBy, 'bg-emerald-500');
  add(
    'rejected',
    t.rejectionReason ? `Rejected — ${t.rejectionReason}` : 'Rejected',
    t.rejectedAt,
    t.rejectedBy,
    'bg-rose-500',
  );
  add('confirmed', 'Confirmed', t.confirmedAt, t.confirmedBy, 'bg-blue-500');
  add('dispatched', 'Dispatched', t.dispatchedAt, t.dispatchedBy, 'bg-indigo-500');
  const lines = (entries: { itemIndex: number; quantity: number; note?: string }[]) =>
    entries
      .map((l) => {
        const item = t.items[l.itemIndex];
        return `${l.quantity} × ${item?.subProductName || 'item'}${item?.sizeName ? ` (${item.sizeName})` : ''}${l.note ? ` — ${l.note}` : ''}`;
      })
      .join(', ');
  (t.receipts || [])
    .filter((r) => !r.shortagesClosed)
    .forEach((r, index) =>
      events.push({
        key: `receipt-${r._id || index}`,
        label: r.lines.length ? `Received: ${lines(r.lines)}` : 'Receipt recorded',
        date: r.receivedAt,
        user: r.receivedBy,
        color: 'bg-emerald-500',
      }),
    );
  if (t.closedWithShortage)
    add('shortage', 'Closed with shortages', t.completedDate, t.completedBy, 'bg-amber-500');
  add('completed', 'Completed', t.completedDate, t.completedBy, 'bg-emerald-500');
  add('cancelled', 'Cancelled', t.cancelledAt, t.cancelledBy, 'bg-red-500');
  (t.returns || []).forEach((r, index) =>
    events.push({
      key: `return-${r._id || index}`,
      label: `Returned: ${lines(r.lines)}`,
      date: r.returnedAt,
      user: r.returnedBy,
      color: 'bg-amber-500',
      detail:
        r.refundedValue != null
          ? `Refunded ${fmtCur(r.refundedValue, t.currency || 'NGN')}${r.remainingValue != null ? ` · Remaining ${fmtCur(r.remainingValue, t.currency || 'NGN')}` : ''}`
          : undefined,
    }),
  );
  const timestamp = (date?: string) =>
    date && Number.isFinite(Date.parse(date)) ? Date.parse(date) : 0;
  events.sort((a, b) => timestamp(a.date) - timestamp(b.date));
  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
      <h3 className="mb-4 text-xs font-medium text-gray-500">Timeline</h3>
      <ol>
        {events.map((entry, index) => (
          <li key={entry.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${entry.color}`} />
              {index < events.length - 1 && <div className="mt-0.5 h-full w-px bg-gray-200" />}
            </div>
            <div className="pb-5">
              <p className="text-sm font-medium text-gray-700">{entry.label}</p>
              <p className="text-xs text-gray-500">
                {entry.date ? new Date(entry.date).toLocaleString() : 'Date unavailable'}
                {entry.user &&
                  ` · by ${typeof entry.user === 'object' ? entry.user.name || 'Unknown user' : 'Unknown user'}`}
              </p>
              {entry.detail && <p className="text-xs text-gray-600">{entry.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
