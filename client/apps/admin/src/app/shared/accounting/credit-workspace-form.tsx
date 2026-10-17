'use client';
import CreditNoteFormModal from './credit-note-form-modal';
import { useCreditInvoices } from './use-credit-invoices';
export default function CreditWorkspaceForm({
  token,
  onClose,
  onSaved,
}: {
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const choices = useCreditInvoices(token);
  return (
    <CreditNoteFormModal
      invoices={choices.invoices}
      defaultPostNow={false}
      invoiceChoices={choices}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
