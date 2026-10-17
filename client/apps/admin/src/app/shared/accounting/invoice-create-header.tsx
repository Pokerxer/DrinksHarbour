'use client';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiPrinter,
  PiFloppyDisk,
  PiArrowUpRight,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { InvoiceCreateAction } from './use-invoice-create-actions';

export default function InvoiceCreateHeader({
  saving,
  hasLines,
  action,
  saveStatus,
  saveError,
  issueError,
  error,
  draftLabel,
  onIssue,
  onSave,
  onPrint,
}: {
  saving: boolean;
  hasLines: boolean;
  action: InvoiceCreateAction;
  saveStatus: string;
  saveError: string;
  issueError: string;
  error: string;
  draftLabel: string;
  onIssue: () => void;
  onSave: () => void;
  onPrint: () => void;
}) {
  const blocked = saving || Boolean(action);
  const button =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40';
  const status =
    action === 'saving' || saveStatus === 'saving'
      ? 'Saving draft…'
      : action === 'printing'
        ? 'Preparing print…'
        : action === 'issuing'
          ? 'Issuing invoice…'
          : saveStatus === 'error'
            ? 'Draft could not be saved'
            : saveStatus === 'saved'
              ? 'Draft saved'
              : 'Unsaved draft';
  return (
    <header className="mb-6 space-y-4 border-b border-gray-200 pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={routes.accounting.invoices}
          className="inline-flex min-h-9 items-center gap-2 text-xs font-medium text-gray-500 hover:text-brand"
        >
          <PiArrowLeft aria-hidden />
          Customer invoices
        </Link>
        <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          {draftLabel}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-lexend text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            Create invoice
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            Build your invoice, review the balance, then issue it to your
            customer.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={blocked || !hasLines || !!saveError}
            className={button}
          >
            <PiFloppyDisk aria-hidden />
            {action === 'saving' ? 'Saving draft…' : 'Save draft'}
          </button>
          <button
            type="button"
            onClick={onPrint}
            disabled={blocked || !hasLines || !!saveError}
            className={button}
          >
            <PiPrinter aria-hidden />
            {action === 'printing' ? 'Preparing print…' : 'Print pro forma'}
          </button>
          <button
            type="button"
            onClick={onIssue}
            disabled={blocked || !hasLines || !!issueError}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-40"
          >
            {action === 'issuing' ? 'Issuing…' : 'Issue invoice'}
            <PiArrowUpRight aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`h-1.5 w-1.5 rounded-full ${saveStatus === 'error' ? 'bg-red-500' : action || saveStatus === 'saving' ? 'bg-amber-500' : saveStatus === 'saved' ? 'bg-emerald-500' : 'bg-gray-300'}`}
          aria-hidden
        />
        <span role="status" className="text-gray-500">
          {status}
        </span>
        <span className="text-gray-300" aria-hidden>
          ·
        </span>
        <span className="text-gray-500">Issuing creates an unpaid invoice</span>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
    </header>
  );
}
