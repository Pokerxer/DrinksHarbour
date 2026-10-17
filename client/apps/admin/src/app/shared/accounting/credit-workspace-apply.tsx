'use client';
import { useEffect, useState } from 'react';
import { arApService, type CreditNote } from '@/services/arAp.service';
import CreditApplyModal from './credit-apply-modal';
import { useCreditInvoices } from './use-credit-invoices';
import { creditCustomer } from './credit-note-helpers';
import { useAccountingDialog } from './use-accounting-dialog';
export default function CreditWorkspaceApply({
  token,
  note,
  onClose,
  onApplied,
}: {
  token: string;
  note: CreditNote;
  onClose: () => void;
  onApplied: () => void;
}) {
  const customer = note.customer?._id || '';
  const choices = useCreditInvoices(token, customer);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    setBalance(null);
    if (!customer) {
      setError(
        'This note has no available customer account. Review the customer before applying credit.'
      );
      return;
    }
    arApService
      .customerCredits(token, customer, { limit: 1 })
      .then((res) => {
        if (active) setBalance(res.data.balance);
      })
      .catch((e: unknown) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Customer credit could not load'
          );
      });
    return () => {
      active = false;
    };
  }, [token, customer, attempt]);
  if (balance !== null)
    return (
      <CreditApplyModal
        token={token}
        customer={customer}
        available={balance}
        invoices={choices.invoices}
        invoiceChoices={choices}
        caption={creditCustomer(note)}
        onClose={onClose}
        onApplied={onApplied}
      />
    );
  return (
    <LoadingCredit
      error={error}
      customer={customer}
      onClose={onClose}
      retry={() => setAttempt((n) => n + 1)}
    />
  );
}
function LoadingCredit({
  error,
  customer,
  onClose,
  retry,
}: {
  error: string;
  customer: string;
  onClose: () => void;
  retry: () => void;
}) {
  const ref = useAccountingDialog(onClose, false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Loading customer credit"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="font-semibold">Customer credit</h2>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : (
          <p role="status" className="mt-3 text-sm text-gray-500">
            Loading available customer credit…
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose}>
            Close
          </button>
          {error && customer && (
            <button
              type="button"
              onClick={retry}
              className="font-medium underline"
            >
              Retry customer credit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
