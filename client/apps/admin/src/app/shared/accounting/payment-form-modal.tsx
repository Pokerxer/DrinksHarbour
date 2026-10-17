'use client';
import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  arApService,
  type OpenBill,
  type OpenInvoice,
  type PaymentSide,
} from '@/services/arAp.service';
import {
  allocationError,
  documentView,
  type AccountingDocument,
} from './accounting-documents';
import { useAccountingDialog } from './use-accounting-dialog';
import { usePaymentDocuments } from './use-payment-documents';
import PaymentAllocations, { type AllocRow } from './payment-allocations';
import PaymentRecordingFields, {
  type PaymentFields,
} from './payment-recording-fields';
import PaymentRecordingPreview from './payment-recording-preview';
function partyOf(doc: AccountingDocument | undefined, side: PaymentSide) {
  if (!doc) return '';
  return side === 'customer'
    ? (doc as OpenInvoice).customer?._id ||
        (doc as OpenInvoice).customerSnapshot?.customerId ||
        ''
    : (doc as OpenBill).vendor?._id || '';
}
export default function PaymentFormModal({
  side,
  initialDocument,
  onClose,
  onSaved,
}: {
  side: PaymentSide;
  initialDocument?: AccountingDocument;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token || '';
  const ar = side === 'customer';
  const initialParty = partyOf(initialDocument, side);
  const [fields, setFields] = useState<PaymentFields>({
    name: initialDocument ? documentView(initialDocument, side).name : '',
    amount: initialDocument ? String(initialDocument.outstanding) : '',
    method: ar ? 'cash' : 'bank_transfer',
    reference: '',
    date: '',
    party: initialParty,
  });
  const choices = usePaymentDocuments(
    token,
    side,
    !fields.party || fields.party === initialParty
      ? initialDocument
      : undefined,
    fields.party || undefined
  );
  const [allocs, setAllocs] = useState<AllocRow[]>(
    initialDocument
      ? [
          {
            docId: initialDocument._id,
            amount: String(initialDocument.outstanding),
          },
        ]
      : []
  );
  const [busy, setBusy] = useState(false);
  const ref = useAccountingDialog(onClose, busy);
  const saving = useRef(false);
  const validationError = allocationError(
    Number(fields.amount),
    allocs,
    choices.docs
  );
  const firstDoc = choices.docs.find((d) => d._id === allocs[0]?.docId);
  const name = firstDoc ? documentView(firstDoc, side).name : fields.name;
  const allocated =
    Math.round(
      allocs.reduce((sum, a) => sum + (Number(a.amount) || 0), 0) * 100
    ) / 100;
  const submit = async () => {
    if (
      saving.current ||
      choices.loading ||
      choices.error ||
      validationError ||
      !name.trim()
    )
      return;
    saving.current = true;
    setBusy(true);
    try {
      await arApService.createPayment(token, side, {
        amount: Number(fields.amount),
        method: fields.method,
        reference: fields.reference || undefined,
        date: fields.date || undefined,
        customer: ar ? fields.party || undefined : undefined,
        vendor: !ar ? fields.party || undefined : undefined,
        customerName: ar ? name : undefined,
        vendorName: !ar ? name : undefined,
        allocations: allocs.map((a) =>
          ar
            ? { salesOrder: a.docId, amount: Number(a.amount) }
            : { vendorBill: a.docId, amount: Number(a.amount) }
        ),
      });
      toast.success(ar ? 'Receipt recorded' : 'Payment recorded');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : 'Payment could not be recorded'
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={ar ? 'Record receipt' : 'Record payment'}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold">
          {ar ? 'Record receipt' : 'Record payment'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Record money already received or paid. This does not initiate a bank
          transfer.
        </p>
        <PaymentRecordingFields
          chooseAccount={!initialDocument}
          token={token}
          side={side}
          value={fields}
          change={(values) => setFields((old) => ({ ...old, ...values }))}
          partyChange={(party, selectedName) => {
            setFields((old) => ({ ...old, party, name: selectedName }));
            setAllocs([]);
          }}
          busy={busy}
        />
        {choices.error && (
          <div
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            <p>Could not load allocations: {choices.error}</p>
            <button
              type="button"
              onClick={choices.reload}
              disabled={choices.loading || busy}
              className="mt-2 font-medium underline"
            >
              Retry allocations
            </button>
          </div>
        )}
        {choices.loading && (
          <p role="status" className="mt-4 text-xs text-gray-500">
            Checking open balances…
          </p>
        )}
        <PaymentAllocations
          side={side}
          openDocs={choices.docs}
          allocs={allocs}
          setAllocs={setAllocs}
          busy={busy || choices.loading || !!choices.error}
          amount={fields.amount}
        />
        {side === 'vendor' && (
          <button
            type="button"
            disabled={busy || choices.loading}
            onClick={choices.refresh}
            className="mt-3 text-xs font-medium underline disabled:opacity-50"
          >
            Refresh bill balances
          </button>
        )}
        {!choices.loading && !choices.error && choices.hasMore && (
          <button
            type="button"
            disabled={busy}
            onClick={choices.loadMore}
            className="mt-3 text-xs font-medium underline"
          >
            Load more allocation documents
          </button>
        )}
        <PaymentRecordingPreview
          amount={Number(fields.amount)}
          allocated={allocated}
          name={name}
          linked={!!fields.party || !!partyOf(firstDoc, side)}
        />
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={
              busy ||
              choices.loading ||
              !!choices.error ||
              !!validationError ||
              !name.trim()
            }
            onClick={submit}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Recording…' : ar ? 'Record receipt' : 'Record payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
