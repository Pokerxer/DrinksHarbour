import type { CreditNote } from '@/services/arAp.service';
export function creditTotal(note: CreditNote) {
  return (
    Math.round((Number(note.amount || 0) + Number(note.taxAmount || 0)) * 100) /
    100
  );
}
export function creditLabel(note: CreditNote) {
  if (note.status === 'draft') return 'Draft';
  if (note.status === 'cancelled') return 'Cancelled';
  if (note.unappliedAmount <= 0.005) return 'Fully applied';
  return note.unappliedAmount >= creditTotal(note) - 0.005
    ? 'Available'
    : 'Partially applied';
}
export function creditCustomer(note: CreditNote) {
  return (
    note.customerName ||
    [note.customer?.firstName, note.customer?.lastName]
      .filter(Boolean)
      .join(' ') ||
    'Customer unavailable'
  );
}
