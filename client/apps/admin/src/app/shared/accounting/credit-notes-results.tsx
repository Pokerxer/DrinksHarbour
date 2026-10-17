'use client';
import type { CreditNote } from '@/services/arAp.service';
import {
  creditCustomer,
  creditLabel,
  creditTotal,
} from './credit-note-helpers';
import { fmtDate, fmtMoney } from './accounting-helpers';
interface Props {
  notes: CreditNote[];
  disabled: boolean;
  onDetail: (note: CreditNote) => void;
  onReview: (note: CreditNote, action: 'post' | 'cancel') => void;
  onApply: (note: CreditNote) => void;
}
export function CreditBadge({ note }: { note: CreditNote }) {
  const label = creditLabel(note);
  const style =
    note.status === 'cancelled'
      ? 'bg-gray-100 text-gray-500'
      : note.status === 'draft'
        ? 'bg-amber-50 text-amber-800'
        : label === 'Fully applied'
          ? 'bg-gray-100 text-gray-700'
          : 'bg-emerald-50 text-emerald-800';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
function Actions({
  note,
  disabled,
  onDetail,
  onReview,
  onApply,
}: Omit<Props, 'notes'> & { note: CreditNote }) {
  const button =
    'rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50';
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button type="button" onClick={() => onDetail(note)} className={button}>
        Details
      </button>
      {note.status === 'draft' && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onReview(note, 'post')}
          className={`${button} bg-gray-900 text-white hover:bg-black`}
        >
          Review posting
        </button>
      )}
      {note.status === 'applied' && note.unappliedAmount > 0.005 && (
        <button
          type="button"
          disabled={disabled || !note.customer?._id}
          onClick={() => onApply(note)}
          className={button}
        >
          Apply customer credit
        </button>
      )}
      {note.status !== 'cancelled' && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onReview(note, 'cancel')}
          className={`${button} text-red-700`}
        >
          {note.status === 'draft' ? 'Cancel draft' : 'Review cancellation'}
        </button>
      )}
    </div>
  );
}
export default function CreditNotesResults(props: Props) {
  if (!props.notes.length)
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm font-medium">No matching credit notes</p>
        <p className="mt-1 text-xs text-gray-500">
          Create a customer adjustment or change your filters.
        </p>
      </div>
    );
  return (
    <>
      <div className="hidden overflow-x-auto rounded-xl border border-gray-200 md:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500">
            <tr>
              {[
                'Credit note / date',
                'Customer / reason',
                'Total credit',
                'Available',
                'Status',
                'Actions',
              ].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {props.notes.map((note) => (
              <tr key={note._id}>
                <td className="px-4 py-4">
                  <button
                    type="button"
                    className="font-semibold underline-offset-4 hover:underline"
                    onClick={() => props.onDetail(note)}
                  >
                    {note.number || 'Unnumbered draft'}
                  </button>
                  <p className="mt-1 text-xs text-gray-500">
                    {fmtDate(note.date)}
                  </p>
                </td>
                <td className="max-w-xs px-4 py-4">
                  <p className="font-medium">{creditCustomer(note)}</p>
                  <p
                    className="mt-1 truncate text-xs text-gray-500"
                    title={note.reason}
                  >
                    {note.reason || 'No reason recorded'}
                  </p>
                </td>
                <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                  {fmtMoney(creditTotal(note))}
                </td>
                <td className="whitespace-nowrap px-4 py-4 tabular-nums">
                  {note.status === 'applied'
                    ? fmtMoney(note.unappliedAmount)
                    : '—'}
                </td>
                <td className="px-4 py-4">
                  <CreditBadge note={note} />
                </td>
                <td className="px-4 py-4">
                  <Actions {...props} note={note} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {props.notes.map((note) => (
          <article
            key={note._id}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {note.number || 'Unnumbered draft'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {fmtDate(note.date)} · {creditCustomer(note)}
                </p>
              </div>
              <CreditBadge note={note} />
            </div>
            <p className="my-3 text-sm text-gray-600">
              {note.reason || 'No reason recorded'}
            </p>
            <dl className="mb-4 grid grid-cols-2 gap-3 border-y border-gray-100 py-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Total credit</dt>
                <dd className="mt-1 font-semibold tabular-nums">
                  {fmtMoney(creditTotal(note))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Available</dt>
                <dd className="mt-1 tabular-nums">
                  {note.status === 'applied'
                    ? fmtMoney(note.unappliedAmount)
                    : '—'}
                </dd>
              </div>
            </dl>
            <Actions {...props} note={note} />
          </article>
        ))}
      </div>
    </>
  );
}
