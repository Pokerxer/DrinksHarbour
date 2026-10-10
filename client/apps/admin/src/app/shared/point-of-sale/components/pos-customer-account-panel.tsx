'use client';

// A customer's tab: what they owe, the statement behind that figure, and taking
// a payment against it.
//
// The balance shown here is the server's, not a running total counted in the
// browser. The statement is append-only and paged, so a locally-summarised
// balance would depend on which page happened to be loaded — and would quietly
// disagree with the ledger. Every action also returns the fresh balance, so this
// never has to guess after a payment.

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { PiX, PiArrowCounterClockwise } from 'react-icons/pi';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import type {
  AccountStatementEntry,
  CustomerAccountSummary,
} from '@/app/shared/point-of-sale/types';
import cn from '@core/utils/class-names';
import { formatCurrency } from '../utils';

interface Props {
  customerId: string;
  customerName?: string | null;
  onClose: () => void;
  /** Lets a parent refresh the customer list after the balance moves. */
  onBalanceChanged?: () => void;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'mobile_money', label: 'Mobile money' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

export function CustomerAccountPanel({ customerId, customerName, onClose, onBalanceChanged }: Props) {
  const { token } = usePOSAuth();
  const [account, setAccount] = useState<CustomerAccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    if (!token || !customerId) return;
    setLoading(true);
    try {
      setAccount(await posApi.getCustomerAccount(token, customerId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this account');
    } finally {
      setLoading(false);
    }
  }, [token, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function takePayment(amount: number, method: string, note?: string) {
    if (!token || !customerId) return;
    setPaying(true);
    try {
      const res = await posApi.takeAccountPayment(token, customerId, { amount, method, note });
      // Use the figures the server just wrote rather than subtracting locally —
      // the ledger, not this screen, is what they have to agree with.
      setAccount(prev => (prev ? { ...prev, balance: res.balance, payments: res.payments, charges: res.charges } : prev));
      toast.success(`Payment of ${formatCurrency(amount)} received`);
      await load();
      onBalanceChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not take that payment');
    } finally {
      setPaying(false);
    }
  }

  const owed = account?.balance ?? 0;

  return (
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Customer account</h2>
          <p className="text-[11px] text-gray-500">{customerName || 'Customer'}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700">
          <PiX className="h-5 w-5" />
        </button>
      </header>

      {loading && !account ? (
        <p className="flex-1 px-5 py-6 text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <div className="flex-1 px-5 py-6">
          <p className="text-sm text-red-600">{error}</p>
          <button type="button" onClick={load} className="mt-3 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
            Try again
          </button>
        </div>
      ) : account ? (
        <>
          <BalanceHeader account={account} />
          <StatementList entries={account.entries} />
          <TakePaymentBar owed={owed} busy={paying} onTake={takePayment} />
        </>
      ) : null}
    </div>
  );
}

function BalanceHeader({ account }: { account: CustomerAccountSummary }) {
  const { balance, creditLimit } = account;
  // No limit set means unlimited credit, not "no headroom" — so show the limit as
  // open-ended rather than pretending they are at zero available.
  const unlimited = creditLimit <= 0;
  const available = unlimited ? null : Math.max(0, creditLimit - balance);
  const overLimit = !unlimited && balance > creditLimit;

  return (
    <div className="border-b border-gray-100 px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Currently owes
      </p>
      <p
        className={cn(
          'mt-1 text-3xl font-bold',
          overLimit ? 'text-red-600' : balance > 0 ? 'text-gray-900' : 'text-green-600'
        )}
      >
        {formatCurrency(balance)}
      </p>
      <p className="mt-1 text-[12px] text-gray-500">
        {balance === 0
          ? 'Settled up.'
          : unlimited
            ? 'No credit limit set.'
            : `${formatCurrency(available ?? 0)} of ${formatCurrency(creditLimit)} still available`}
      </p>
      {overLimit && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
          This is over their limit. It can only grow with a manager&apos;s approval.
        </p>
      )}
    </div>
  );
}

function StatementList({ entries }: { entries: AccountStatementEntry[] }) {
  if (!entries.length) {
    return <p className="flex-1 px-5 py-6 text-sm text-gray-500">No activity yet.</p>;
  }
  return (
    <div className="flex-1 overflow-y-auto px-5 py-3">
      <ul className="divide-y divide-gray-50">
        {entries.map(entry => (
          <StatementRow key={entry._id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}

function StatementRow({ entry }: { entry: AccountStatementEntry }) {
  const isCharge = entry.entryType === 'charge';
  // A credit is neither money in nor a sale: it lowers the balance on its own, so
  // it is shown with its own wording rather than filed under payments.
  const label = isCharge ? 'Sale' : entry.entryType === 'credit' ? 'Refund' : entry.method || 'Payment';

  return (
    <li className={cn('flex items-start justify-between gap-3 py-2.5', entry.voided && 'opacity-50')}>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium text-gray-800">
          {label}
          {entry.voided && <span className="ml-2 text-[11px] text-gray-400">reversed</span>}
        </p>
        {entry.note && <p className="truncate text-[11px] text-gray-500">{entry.note}</p>}
        {entry.overrideReason && (
          <p className="truncate text-[11px] italic text-amber-700">
            Over limit: {entry.overrideReason}
          </p>
        )}
        <p className="text-[11px] text-gray-400">{new Date(entry.occurredAt).toLocaleString()}</p>
      </div>
      <span
        className={cn(
          'shrink-0 text-[13px] font-semibold',
          isCharge ? 'text-gray-900' : 'text-green-600'
        )}
      >
        {isCharge ? '+' : '−'}{formatCurrency(entry.amount)}
      </span>
    </li>
  );
}

function TakePaymentBar({
  owed,
  busy,
  onTake,
}: {
  owed: number;
  busy: boolean;
  onTake: (amount: number, method: string, note?: string) => void;
}) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');

  const value = Number(amount) || 0;
  const valid = value > 0 && value <= owed;

  function submit() {
    if (!valid) return;
    onTake(value, method);
    setAmount('');
  }

  if (owed <= 0) return null;

  return (
    <div className="border-t border-gray-100 px-5 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        Take a payment
      </p>
      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder={String(owed)}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202]"
        />
        <button
          type="button"
          onClick={() => setAmount(String(owed))}
          className="rounded-lg border border-gray-200 px-3 py-2 text-[12px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          All
        </button>
      </div>
      <div className="mt-2 flex gap-2">
        <select
          value={method}
          onChange={e => setMethod(e.target.value)}
          className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] outline-none"
        >
          {PAYMENT_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={!valid || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#8f0202] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PiArrowCounterClockwise className="h-4 w-4" />
          {busy ? 'Saving…' : 'Pay'}
        </button>
      </div>
      {amount !== '' && value > owed && (
        <p className="mt-1.5 text-[11px] text-red-600">
          That is more than they owe ({formatCurrency(owed)}).
        </p>
      )}
    </div>
  );
}