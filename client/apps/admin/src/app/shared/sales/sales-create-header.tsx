// client/apps/admin/src/app/shared/sales/sales-create-header.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import {
  PiArrowLeft,
  PiCaretRight,
  PiChartLineUp,
  PiCircleNotch,
  PiCloudArrowUp,
  PiCloudCheck,
  PiCloudWarning,
  PiCopy,
  PiEnvelope,
  PiGear,
  PiLink,
  PiFolderSimplePlus,
  PiPaperPlaneTilt,
  PiPencilSimple,
  PiPrinter,
  PiShareNetwork,
  PiTag,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { StagePill } from './sales-stage-pill';
import { quoteStatusLabel, orderStatusLabel } from './sales-helpers';
import { salesOrderService } from '@/services/salesOrder.service';
import type { SalesOrder } from '@/services/salesOrder.service';

export interface SalesCreateHeaderProps {
  mode: 'create' | 'edit';
  initial?: SalesOrder;
  saving: boolean;
  hasLines: boolean;
  orderId?: string;
  token: string;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onManualSave?: () => void;
  onSaveQuotation?: () => void;
  onCreateOrder?: () => void;
  onSaveEdit?: () => void;
  onPrint?: () => void;
  onSendProForma?: () => void;
  onStatusChange?: () => void;
}

const BTN_BASE =
  'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40';

const BTN_PRIMARY = `${BTN_BASE} bg-brand text-white hover:bg-brand-dark active:scale-[0.98]`;
const BTN_GHOST = `${BTN_BASE} bg-white text-gray-700 ring-1 ring-gray-200 hover:bg-gray-50`;

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
  orderId,
  token,
  autoSaveStatus = 'idle',
  onManualSave,
  onSaveQuotation,
  onCreateOrder,
  onSaveEdit,
  onPrint,
  onSendProForma,
  onStatusChange,
}: SalesCreateHeaderProps) {
  const isEdit = mode === 'edit' && !!initial;
  const backHref = isEdit
    ? routes.eCommerce.salesDetails(initial!._id)
    : routes.eCommerce.salesOrders;
  const cancelHref = backHref;

  const router = useRouter();

  // Derived action handlers
  const handleSend = isEdit ? onSaveEdit : onSaveQuotation;
  const handleConfirm = isEdit ? onSaveEdit : onCreateOrder;

  // Gear action handlers
  const handleDuplicate = async () => {
    if (!orderId) { toast('No order to duplicate'); return; }
    try {
      const res = await salesOrderService.duplicate(orderId, token);
      toast('Order duplicated');
      router.push(routes.eCommerce.salesDetails(res.data._id));
    } catch { toast('Failed to duplicate order'); }
  };

  const handleMarkAsSent = async () => {
    if (!orderId) { toast('No order to mark'); return; }
    try {
      await salesOrderService.send(orderId, token);
      toast('Marked as sent');
      onStatusChange?.();
    } catch { toast('Failed to mark as sent'); }
  };

  const handleGeneratePaymentLink = async () => {
    if (!orderId) { toast('No order selected'); return; }
    try {
      const res = await salesOrderService.generatePaymentLink(orderId, token);
      window.open(res.data.paymentLink, '_blank');
      toast('Payment link generated');
    } catch { toast('Failed to generate payment link'); }
  };

  const handleAccruedRevenueEntry = async () => {
    if (!orderId) { toast('No order selected'); return; }
    try {
      await salesOrderService.accruedRevenue(orderId, token);
      toast('Accrued revenue entry created');
    } catch { toast('Failed to create accrued revenue entry'); }
  };

  const handleRequestSignature = async () => {
    if (!orderId) { toast('No order selected'); return; }
    try {
      await salesOrderService.requestSignature(orderId, token);
      toast('Signature request sent');
    } catch { toast('Failed to request signature'); }
  };

  const handleSendEmail = async () => {
    if (!orderId) { toast('No order selected'); return; }
    try {
      await salesOrderService.sendEmail(orderId, token);
      toast('Email sent');
    } catch { toast('Failed to send email'); }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Link copied to clipboard');
    } catch { toast('Failed to copy link'); }
  };

  const handleCreateProject = async () => {
    if (!orderId) { toast('No order selected'); return; }
    try {
      await salesOrderService.createProject(orderId, token);
      toast('Project created');
    } catch { toast('Failed to create project'); }
  };

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

        {/* Cloud save button */}
        <button
          type="button"
          onClick={onManualSave}
          disabled={autoSaveStatus === 'saving' || !hasLines}
          title={
            autoSaveStatus === 'saving'
              ? 'Saving…'
              : autoSaveStatus === 'saved'
                ? 'Saved'
                : autoSaveStatus === 'error'
                  ? 'Save failed — click to retry'
                  : 'Save draft'
          }
          className="flex items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {autoSaveStatus === 'saving' ? (
            <PiCircleNotch className="h-5 w-5 animate-spin text-gray-400" />
          ) : autoSaveStatus === 'saved' ? (
            <PiCloudCheck className="h-5 w-5 text-emerald-500" />
          ) : autoSaveStatus === 'error' ? (
            <PiCloudWarning className="h-5 w-5 text-red-500" />
          ) : (
            <PiCloudArrowUp className="h-5 w-5 text-gray-400" />
          )}
        </button>

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
            <div className="absolute left-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
              {gearItem(onPrint, 'Print', PiPrinter, true)}
              {gearItem(
                onSendProForma,
                'Send PRO-FORMA Invoice',
                PiPaperPlaneTilt
              )}
              {gearItem(handleRequestSignature, 'Request Signature', PiPencilSimple)}
              {gearItem(handleDuplicate, 'Duplicate', PiCopy)}
              <div className="my-1 border-t border-gray-100" />
              {gearItem(
                handleAccruedRevenueEntry,
                'Accrued Revenue Entry',
                PiChartLineUp
              )}
              {gearItem(
                handleGeneratePaymentLink,
                'Generate a Payment Link',
                PiLink
              )}
              {gearItem(handleSendEmail, 'Send an email', PiEnvelope)}
              {gearItem(handleMarkAsSent, 'Mark Quotation as Sent', PiTag)}
              {gearItem(handleShare, 'Share', PiShareNetwork)}
              {gearItem(handleCreateProject, 'Create Project', PiFolderSimplePlus)}
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving || !hasLines}
          className={BTN_PRIMARY}
        >
          {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Confirm Order'}
        </button>

        {!isEdit && (
          <button
            type="button"
            onClick={handleSend}
            disabled={saving || !hasLines}
            className={BTN_GHOST}
          >
            Save Quotation
          </button>
        )}

        <button type="button" onClick={onPrint} className={BTN_GHOST}>
          <PiPrinter className="h-4 w-4" />
          Print
        </button>

        {isEdit && initial && (
          <Link
            href={routes.eCommerce.salesDetails(initial._id)}
            className={BTN_GHOST}
          >
            Preview
          </Link>
        )}

        <Link
          href={cancelHref}
          className={`${BTN_BASE} text-gray-500 hover:bg-gray-50 hover:text-gray-700`}
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}
