'use client';
import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  arApService,
  type BatchAccount,
  type PaymentSide,
} from '@/services/arAp.service';
import { useBatchSelection } from './use-batch-selection';
import BatchDialog from './batch-dialog';
import BatchPaymentPicker from './batch-payment-picker';
import { batchAccountName } from './batch-workspace-toolbar';
import { fmtMoney } from './accounting-helpers';
export default function BatchFormModal({
  side,
  onClose,
  onSaved,
}: {
  side: PaymentSide;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const choices = useBatchSelection(token, side);
  const [busy, setBusy] = useState(false),
    [mustRefresh, setMustRefresh] = useState(false),
    [writeError, setWriteError] = useState('');
  const saving = useRef(false);
  const members = Array.from(choices.selected.values()),
    total = Math.round(members.reduce((n, m) => n + m.amount, 0) * 100) / 100;
  const blocked =
    choices.loading ||
    choices.checking ||
    !!choices.error ||
    !!choices.reviewIssue ||
    mustRefresh;
  const submit = async () => {
    if (
      saving.current ||
      blocked ||
      !token ||
      !members.length ||
      members.length > 500
    )
      return;
    saving.current = true;
    setBusy(true);
    setWriteError('');
    try {
      await arApService.createBatch(token, {
        direction: side,
        account: choices.account,
        paymentIds: members.map((m) => m.key),
        expectedMembers: members.map(
          ({ key, amount, capturedAmount, refundedAmount }) => ({
            key,
            amount,
            capturedAmount,
            refundedAmount,
          })
        ),
      });
      toast.success('Batch created');
      onSaved();
      onClose();
    } catch (e) {
      setMustRefresh(true);
      setWriteError(
        e instanceof Error ? e.message : 'Batch creation could not be confirmed'
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <BatchDialog
      title="New batch"
      busy={busy || choices.checking}
      close={onClose}
    >
      <p className="mt-2 text-sm text-gray-500">
        Group recorded{' '}
        {side === 'customer'
          ? 'Accounting, Sales and POS receipt portions'
          : 'vendor payments'}
        . Reconciliation changes no money or wallet balance.
      </p>
      <label className="mt-4 block text-xs font-medium text-gray-600">
        Reconciliation account
        <select
          disabled={busy || choices.checking}
          value={choices.account}
          onChange={(e) =>
            choices.changeAccount(e.target.value as BatchAccount)
          }
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          {(['1000', '1100', '2200'] as const).map((account) => (
            <option key={account} value={account}>
              {batchAccountName(account)}
            </option>
          ))}
        </select>
      </label>
      {choices.account === '2200' && (
        <p className="mt-2 text-xs text-gray-500">
          Wallet portions reconcile separately. This does not deposit money into
          a bank.
          {side === 'vendor'
            ? ' The current vendor payment flow has no saved wallet payments.'
            : ''}
        </p>
      )}
      {choices.error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          Payments could not load: {choices.error}
          <button
            type="button"
            disabled={busy || choices.loading}
            onClick={choices.retry}
            className="ml-2 underline"
          >
            Retry payments
          </button>
        </p>
      )}
      <BatchPaymentPicker
        key={choices.account}
        rows={choices.rows}
        selected={choices.selected}
        toggle={choices.toggle}
        search={choices.search}
        changeSearch={choices.setSearch}
        loading={choices.loading}
        disabled={busy || choices.checking}
      />
      {!choices.loading && !choices.error && !choices.rows.length && (
        <p className="mt-3 text-sm text-gray-500">
          No eligible payments in this account. Choose another account, record a
          payment, or review source refunds.
        </p>
      )}
      {!choices.loading && !choices.error && choices.hasMore && (
        <button
          type="button"
          disabled={busy || choices.checking}
          onClick={choices.loadMore}
          className="mt-3 text-xs font-medium underline"
        >
          Load more payments
        </button>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
        <p className="text-sm font-semibold tabular-nums">
          {members.length} selected · {fmtMoney(total)}
        </p>
        {members.length > 0 && (
          <button
            type="button"
            disabled={busy || choices.checking}
            onClick={choices.clear}
            className="text-xs underline"
          >
            Clear selections
          </button>
        )}
      </div>
      {members.length > 0 && (
        <p className="mt-1 text-xs text-gray-500">
          Selections stay selected across pages and searches.
        </p>
      )}
      {(choices.reviewIssue || writeError) && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          {choices.reviewIssue ||
            `${writeError}. Refresh payments to check the result before trying again.`}
        </p>
      )}
      <button
        type="button"
        disabled={busy || choices.loading || choices.checking}
        onClick={async () => {
          if (await choices.refresh()) {
            setMustRefresh(false);
            setWriteError('');
          }
        }}
        className="mt-3 text-xs font-medium underline disabled:opacity-50"
      >
        {choices.checking ? 'Checking selections…' : 'Refresh payments'}
      </button>
      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy || choices.checking}
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || blocked || !members.length || members.length > 500}
          onClick={submit}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create batch'}
        </button>
      </div>
    </BatchDialog>
  );
}
