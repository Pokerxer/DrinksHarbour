'use client';
import Link from 'next/link';
import { PiArrowLeft, PiFloppyDisk, PiPrinter } from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { SalesOrder } from '@/services/salesOrder.service';
import { SalesSteps, salesStepIndex } from './sales-stage-pill';
import SalesCreateMoreActions from './sales-create-more-actions';
import { docStatusBadge } from './sales-list-status';
export interface SalesCreateHeaderProps {
  readOnly?: boolean;
  mode: 'create' | 'edit';
  initial?: SalesOrder;
  saving: boolean;
  hasLines: boolean;
  orderId?: string;
  token: string;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  action?: string | null;
  error?: string;
  saveError?: string;
  confirmError?: string;
  onManualSave?: () => void;
  onSaveQuotation?: () => void;
  onCreateOrder?: () => void;
  onSaveEdit?: () => void;
  onPrint?: () => void;
  onSendProForma?: () => void;
  onStatusChange?: () => void;
}
export default function SalesCreateHeader({
  readOnly = false,
  mode,
  initial,
  saving,
  hasLines,
  orderId,
  token,
  autoSaveStatus = 'idle',
  action,
  error,
  saveError,
  confirmError,
  onManualSave,
  onSaveQuotation,
  onCreateOrder,
  onSaveEdit,
  onPrint,
  onSendProForma,
  onStatusChange,
}: SalesCreateHeaderProps) {
  const isEdit = mode === 'edit' && !!initial;
  const blocked = saving || !!action || autoSaveStatus === 'saving';
  const button =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-40';
  const status =
    readOnly && initial
      ? `${docStatusBadge(initial).label}${initial.locked ? ' · Locked' : ' · Read-only'}`
      : action === 'printing'
        ? 'Preparing print…'
        : action === 'confirming'
          ? 'Confirming order…'
          : action === 'saving' || autoSaveStatus === 'saving'
            ? 'Saving draft…'
            : autoSaveStatus === 'error'
              ? 'Draft could not be saved'
              : autoSaveStatus === 'saved'
                ? 'Draft saved'
                : 'Unsaved draft';
  return (
    <header className="mb-6 space-y-4 border-b border-gray-200 pb-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={routes.eCommerce.salesOrders}
          className="inline-flex min-h-9 items-center gap-2 text-xs font-medium text-gray-500 hover:text-brand"
        >
          <PiArrowLeft aria-hidden /> Sales
        </Link>
        <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
          {initial?.soNumber || (orderId ? 'Saved draft' : 'New draft')}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-lexend text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            {isEdit
              ? initial.docType === 'quotation'
                ? 'Edit quotation'
                : 'Edit sales order'
              : 'Create quotation'}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-gray-500">
            Build your quotation, review the total, then confirm the sales
            order.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none">
          {!readOnly && (
            <button
              type="button"
              className={button}
              onClick={onManualSave}
              disabled={blocked || !hasLines || !!saveError}
            >
              <PiFloppyDisk aria-hidden />
              {action === 'saving' ? 'Saving draft…' : 'Save draft'}
            </button>
          )}
          <button
            type="button"
            className={button}
            onClick={onPrint}
            disabled={blocked || !hasLines || !!saveError}
          >
            <PiPrinter aria-hidden />
            {action === 'printing'
              ? 'Preparing print…'
              : isEdit && initial.docType === 'order'
                ? 'Print document'
                : 'Print quotation'}
          </button>
          {!readOnly && (
            <button
              type="button"
              className={`${button} !border-brand !bg-brand !text-white hover:!bg-red-800`}
              onClick={isEdit ? onSaveEdit : onCreateOrder}
              disabled={
                blocked || !hasLines || !!(isEdit ? saveError : confirmError)
              }
            >
              {action === 'confirming'
                ? 'Confirming…'
                : isEdit
                  ? 'Save changes'
                  : 'Confirm order'}
            </button>
          )}
          {!isEdit && (
            <button
              type="button"
              className={button}
              onClick={onSaveQuotation}
              disabled={blocked || !hasLines || !!saveError}
            >
              Save quotation
            </button>
          )}
          <SalesCreateMoreActions
            orderId={orderId}
            token={token}
            disabled={blocked}
            readOnly={readOnly}
            onPrint={onPrint}
            onSendProForma={onSendProForma}
            onStatusChange={onStatusChange}
          />
          {isEdit && (
            <Link
              href={routes.eCommerce.salesDetails(initial._id)}
              className={button}
            >
              Preview
            </Link>
          )}
          <Link
            href={
              isEdit
                ? routes.eCommerce.salesDetails(initial._id)
                : routes.eCommerce.salesOrders
            }
            className="px-2 py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            {isEdit ? 'Back to order' : 'Discard'}
          </Link>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-gray-500">
          {status}
        </p>
        <SalesSteps
          current={salesStepIndex(
            initial?.docType,
            initial?.quoteStatus,
            initial?.orderStatus,
          )}
        />
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
