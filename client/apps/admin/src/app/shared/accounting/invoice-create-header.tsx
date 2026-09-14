'use client';
import Link from 'next/link';
import { PiArrowLeft, PiPrinter } from 'react-icons/pi';
import { routes } from '@/config/routes';

export default function InvoiceCreateHeader({
  saving,
  hasLines,
  saveStatus,
  dueDate,
  onDueDate,
  onIssue,
  onSave,
  onPrint,
}: {
  saving: boolean;
  hasLines: boolean;
  saveStatus: string;
  dueDate: string;
  onDueDate: (value: string) => void;
  onIssue: () => void;
  onSave: () => void;
  onPrint: () => void;
}) {
  return (
    <header className="mb-6 space-y-4">
      <Link
        href={routes.accounting.invoices}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-gray-600"
      >
        <PiArrowLeft /> Customer invoices
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Create invoice
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Issue an unpaid invoice, then record payment when it arrives.
          </p>
        </div>
        <label className="grid gap-1 text-sm text-gray-600">
          Payment due date
          <input
            type="date"
            value={dueDate}
            onChange={(event) => onDueDate(event.target.value)}
            className="min-h-11 rounded-lg border border-gray-200 bg-white px-3"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onIssue}
          disabled={saving || !hasLines}
          className="min-h-11 rounded-xl bg-brand px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Issuing…' : 'Issue invoice'}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !hasLines}
          className="min-h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={onPrint}
          disabled={saving || !hasLines}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm disabled:opacity-50"
        >
          <PiPrinter /> Print pro forma
        </button>
        <span role="status" className="text-sm text-gray-500">
          {saveStatus === 'error'
            ? 'Draft could not be saved. Try again.'
            : saveStatus === 'saved'
              ? 'Draft saved'
              : saveStatus === 'saving'
                ? 'Saving draft…'
                : ''}
        </span>
      </div>
    </header>
  );
}
