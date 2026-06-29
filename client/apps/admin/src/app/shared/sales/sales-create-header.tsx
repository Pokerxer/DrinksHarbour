// client/apps/admin/src/app/shared/sales/sales-create-header.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiCaretRight,
  PiChartLineUp,
  PiCopy,
  PiEnvelope,
  PiGear,
  PiLink,
  PiFolderSimplePlus,
  PiPencilSimple,
  PiPrinter,
  PiShareNetwork,
  PiTag,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { StagePill } from './sales-stage-pill';
import { quoteStatusLabel, orderStatusLabel } from './sales-helpers';
import type { SalesOrder } from '@/services/salesOrder.service';

export interface SalesCreateHeaderProps {
  mode: 'create' | 'edit';
  initial?: SalesOrder;
  saving: boolean;
  hasLines: boolean;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onSaveQuotation?: () => void;
  onCreateOrder?: () => void;
  onSaveEdit?: () => void;
  onPrint?: () => void;
  onSendProForma?: () => void;
  onDuplicate?: () => void;
  onMarkAsSent?: () => void;
  onGeneratePaymentLink?: () => void;
  onAccruedRevenueEntry?: () => void;
}

const BTN_BASE =
  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40';

const BTN_DARK = `${BTN_BASE} bg-gray-800 text-white hover:bg-gray-700`;
const BTN_PURPLE = `${BTN_BASE} bg-[#5c3d7a] text-white hover:bg-[#4e3366]`;

const AUTO_SAVE_LABEL: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export default function SalesCreateHeader({
  mode,
  initial,
  saving,
  hasLines,
  autoSaveStatus = 'idle',
  onSaveQuotation,
  onCreateOrder,
  onSaveEdit,
  onPrint,
  onSendProForma,
  onDuplicate,
  onMarkAsSent,
  onGeneratePaymentLink,
  onAccruedRevenueEntry,
}: SalesCreateHeaderProps) {
  const isEdit = mode === 'edit' && !!initial;
  const backHref = isEdit
    ? routes.eCommerce.salesDetails(initial!._id)
    : routes.eCommerce.salesOrders;
  const cancelHref = backHref;

  // Derived action handlers
  const handleSend = isEdit ? onSaveEdit : onSaveQuotation;
  const handleConfirm = isEdit ? onSaveEdit : onCreateOrder;

  // Gear dropdown state
  const [gearOpen, setGearOpen] = useState(false);
  const gearRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node))
        setGearOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function gearItem(
    action: (() => void) | undefined,
    label: string,
    Icon: React.ElementType,
    hasArrow?: boolean
  ) {
    return (
      <button
        type="button"
        onClick={() => {
          action?.();
          setGearOpen(false);
        }}
        className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50"
      >
        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="flex-1 text-left">{label}</span>
        {hasArrow && <PiCaretRight className="h-3.5 w-3.5 text-gray-400" />}
      </button>
    );
  }

  return (
    <div className="mb-5">
      {/* Breadcrumb */}
      <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesOrders}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Sales
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">
          {isEdit ? initial!.soNumber : 'New'}
        </span>
      </div>

      {/* Title row + gear */}
      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">
          {isEdit
            ? initial!.docType === 'quotation'
              ? 'Quotation'
              : 'Sales Order'
            : 'New'}
        </h1>

        {/* Auto-save status */}
        {autoSaveStatus !== 'idle' && (
          <span
            className={`text-xs ${
              autoSaveStatus === 'saving'
                ? 'text-gray-400'
                : autoSaveStatus === 'saved'
                  ? 'text-emerald-500'
                  : 'text-red-500'
            }`}
          >
            {AUTO_SAVE_LABEL[autoSaveStatus]}
          </span>
        )}

        {/* Gear dropdown */}
        <div ref={gearRef} className="relative">
          <button
            type="button"
            onClick={() => setGearOpen((v) => !v)}
            title="More actions"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <PiGear className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          </button>

          {gearOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {gearItem(onPrint, 'Print', PiPrinter, true)}
              {gearItem(undefined, 'Request Signature', PiPencilSimple)}
              {gearItem(onDuplicate, 'Duplicate', PiCopy)}
              <div className="my-1 border-t border-gray-100" />
              {gearItem(
                onAccruedRevenueEntry,
                'Accrued Revenue Entry',
                PiChartLineUp
              )}
              {gearItem(
                onGeneratePaymentLink,
                'Generate a Payment Link',
                PiLink
              )}
              {gearItem(undefined, 'Send an email', PiEnvelope)}
              {gearItem(onMarkAsSent, 'Mark Quotation as Sent', PiTag)}
              {gearItem(undefined, 'Share', PiShareNetwork)}
              {gearItem(undefined, 'Create Project', PiFolderSimplePlus)}
            </div>
          )}
        </div>

        {/* Stage pills */}
        <div className="ml-2 flex items-center gap-1.5">
          {isEdit ? (
            <StagePill
              label={
                initial!.docType === 'quotation'
                  ? quoteStatusLabel(initial!.quoteStatus)
                  : orderStatusLabel(initial!.orderStatus)
              }
              active
            />
          ) : (
            <>
              <StagePill label="Quotation" active />
              <StagePill label="Quotation Sent" active={false} />
              <StagePill label="Sales Order" active={false} />
            </>
          )}
        </div>
      </div>

      {/* Action button bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={handleSend}
          disabled={saving || !hasLines}
          className={BTN_PURPLE}
        >
          {saving && !isEdit ? 'Saving…' : 'Send'}
        </button>

        <button
          type="button"
          onClick={onSendProForma}
          disabled={saving || !hasLines}
          className={BTN_PURPLE}
        >
          Send PRO-FORMA Invoice
        </button>

        <button type="button" onClick={onPrint} className={BTN_DARK}>
          <PiPrinter className="h-3.5 w-3.5" />
          Print
        </button>

        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || !hasLines}
          className={BTN_DARK}
        >
          {saving ? 'Saving…' : 'Confirm'}
        </button>

        {isEdit && initial && (
          <Link
            href={routes.eCommerce.salesDetails(initial._id)}
            className={BTN_DARK}
          >
            Preview
          </Link>
        )}
        {!isEdit && (
          <button type="button" disabled className={BTN_DARK}>
            Preview
          </button>
        )}

        <Link href={cancelHref} className={BTN_DARK}>
          Cancel
        </Link>
      </div>
    </div>
  );
}
