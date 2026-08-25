'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import {
  accountingService,
  type Account,
  type JournalLine,
} from '@/services/accounting.service';
import { fmtMoney, linesBalanced } from './accounting-helpers';

interface FormLine {
  account: string;
  debit: string;
  credit: string;
  memo: string;
}

const EMPTY_LINE: FormLine = { account: '', debit: '', credit: '', memo: '' };

const INPUT_CLS =
  'w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-gray-400 disabled:bg-gray-100';

/** Manual journal entry modal with dynamic lines and a live balance check. */
export default function JournalEntryFormModal({
  accounts,
  onClose,
  onPosted,
}: {
  accounts: Account[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const activeAccounts = useMemo(() => accounts.filter((a) => a.isActive), [accounts]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<FormLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
  const [busy, setBusy] = useState(false);

  const balance = linesBalanced(lines);

  const setLine = (i: number, patch: Partial<FormLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    if (!balance.balanced) return;
    setBusy(true);
    try {
      await accountingService.createJournalEntry(token, {
        date,
        memo: memo || undefined,
        lines: lines
          .filter((l) => l.account)
          .map<JournalLine>((l) => ({
            account: l.account,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            memo: l.memo || undefined,
          })),
      });
      toast.success('Entry posted');
      onPosted();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="New manual entry"
      >
        <h3 className="text-base font-semibold text-gray-900">New Manual Entry</h3>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-gray-600">
            Date
            <input
              type="date"
              className={`${INPUT_CLS} mt-1`}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-gray-600 sm:col-span-2">
            Memo
            <input
              type="text"
              className={`${INPUT_CLS} mt-1`}
              placeholder="What is this entry for?"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={200}
            />
          </label>
        </div>

        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-[2fr_1fr_1fr_1.4fr_auto] gap-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            <span>Account</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Credit</span>
            <span>Memo</span>
            <span />
          </div>
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1.4fr_auto] items-center gap-2">
              <select
                className={INPUT_CLS}
                value={line.account}
                onChange={(e) => setLine(i, { account: e.target.value })}
                aria-label={`Account line ${i + 1}`}
              >
                <option value="">Select account…</option>
                {activeAccounts.map((a) => (
                  <option key={a._id} value={a.code}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${INPUT_CLS} text-right`}
                value={line.debit}
                onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })}
                aria-label={`Debit line ${i + 1}`}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                className={`${INPUT_CLS} text-right`}
                value={line.credit}
                onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })}
                aria-label={`Credit line ${i + 1}`}
              />
              <input
                type="text"
                className={INPUT_CLS}
                value={line.memo}
                onChange={(e) => setLine(i, { memo: e.target.value })}
                aria-label={`Memo line ${i + 1}`}
              />
              <button
                type="button"
                disabled={lines.length <= 2}
                onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:opacity-30"
                aria-label={`Remove line ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}
            className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:text-gray-900"
          >
            + Add Line
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
          <p
            className={`text-sm font-medium ${
              balance.balanced ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {balance.balanced
              ? '✓ Balanced'
              : `Unbalanced — Debits ${fmtMoney(balance.debit)} vs Credits ${fmtMoney(balance.credit)}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!balance.balanced || busy}
              onClick={submit}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
            >
              Post Entry
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
