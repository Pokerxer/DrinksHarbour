// client/apps/admin/src/app/shared/sales/sales-quotation-detail.tsx
// Quotation document view. Chrome lives in sales-detail-shell; this file owns
// the quotation lifecycle: send → accept → convert, plus the expiry clock the
// server never runs (nothing sets 'expired' server-side, so a stale deadline
// is surfaced here instead of silently reading as "Sent").

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  PiPaperPlaneTilt,
  PiCheck,
  PiX,
  PiArrowsClockwise,
  PiPencilSimple,
  PiPrinter,
  PiWarning,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import { fmtDate } from './sales-helpers';
import type { PrintSheetType } from './sales-print-sheet';
import SalesPrintSheet from './sales-print-sheet';
import SalesDetailShell, { type DetailAction } from './sales-detail-shell';
import SalesQuotationDetailInfo from './sales-quotation-detail-info';
import SalesQuotationDetailLines from './sales-quotation-detail-lines';
import { quoteExpiry } from './sales-detail-logic';

const QUOTE_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; dot: string }
> = {
  draft: { label: 'Draft', bg: '#f4f4f5', color: '#52525b', dot: '#a1a1aa' },
  sent: { label: 'Sent', bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  accepted: {
    label: 'Accepted',
    bg: '#f0fdf4',
    color: '#15803d',
    dot: '#22c55e',
  },
  rejected: { label: 'Rejected', bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
  expired: { label: 'Expired', bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  converted: {
    label: 'Converted',
    bg: '#f5f3ff',
    color: '#6d28d9',
    dot: '#8b5cf6',
  },
};

function ExpiryBanner({
  state,
  daysLeft,
  until,
}: {
  state: 'expired' | 'soon';
  daysLeft: number | null;
  until: string;
}) {
  if (state === 'expired') {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
        <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          This quotation expired on{' '}
          <span className="font-semibold">{fmtDate(until)}</span>. Its prices
          may no longer be valid — extend the validity or re-quote before
          accepting.
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
      <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Expires{' '}
        {daysLeft === 0 ? (
          <span className="font-semibold">today</span>
        ) : (
          <>
            in <span className="font-semibold">{daysLeft} day(s)</span>
          </>
        )}{' '}
        · {fmtDate(until)}
      </p>
    </div>
  );
}

export default function SalesQuotationDetail({
  so,
  onChanged,
}: {
  so: SalesOrder;
  onChanged: () => void;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [busy, setBusy] = useState(false);
  const [printState, setPrintState] = useState<{ type: PrintSheetType } | null>(
    null
  );

  async function run(
    action: () => Promise<{ data: SalesOrder }>,
    successMsg: string
  ) {
    setBusy(true);
    try {
      await action();
      toast.success(successMsg);
      onChanged();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  function handlePrint(type: PrintSheetType) {
    setPrintState({ type });
    setTimeout(() => window.print(), 150);
  }

  function handleConvert() {
    // Convert is in-place and terminal — worth one beat of friction.
    if (!window.confirm(`Convert ${so.soNumber} into a sales order?`)) return;
    void run(() => salesOrderService.convert(so._id, token), 'Converted to order');
  }

  function handleReject() {
    if (!window.confirm(`Reject ${so.soNumber}? This closes the quotation.`))
      return;
    void run(() => salesOrderService.reject(so._id, token), 'Quotation rejected');
  }

  const status = so.quoteStatus ?? 'draft';
  const sc = QUOTE_STATUS_CONFIG[status] ?? QUOTE_STATUS_CONFIG.draft;
  const expiry = quoteExpiry(so.validUntil, status);

  const lineCount = so.items.filter(
    (i) => i.lineType !== 'section' && i.lineType !== 'note'
  ).length;

  const actions: DetailAction[] = [
    status === 'draft' && {
      key: 'send',
      label: 'Send to Customer',
      icon: <PiPaperPlaneTilt className="h-4 w-4" />,
      onClick: () =>
        void run(() => salesOrderService.send(so._id, token), 'Quotation sent'),
      variant: 'primary',
      disabled: busy,
    },
    status === 'sent' && {
      key: 'accept',
      label: 'Accept Quote',
      icon: <PiCheck className="h-4 w-4" />,
      onClick: () =>
        void run(() => salesOrderService.accept(so._id, token), 'Quotation accepted'),
      variant: 'primary',
      disabled: busy,
    },
    status === 'accepted' && {
      key: 'convert',
      label: 'Convert to Order',
      icon: <PiArrowsClockwise className="h-4 w-4" />,
      onClick: handleConvert,
      variant: 'primary',
      disabled: busy,
    },
    (status === 'draft' || status === 'sent') && {
      key: 'edit',
      label: 'Edit',
      icon: <PiPencilSimple className="h-4 w-4" />,
      href: routes.eCommerce.salesEdit(so._id),
      disabled: busy,
    },
    status === 'sent' && {
      key: 'reject',
      label: 'Reject',
      icon: <PiX className="h-4 w-4" />,
      onClick: handleReject,
      variant: 'quiet-danger',
      disabled: busy,
    },
    {
      key: 'print',
      label: 'Print',
      icon: <PiPrinter className="h-4 w-4" />,
      onClick: () => handlePrint('quotation'),
    },
  ].filter(Boolean) as DetailAction[];

  return (
    <>
      {printState && <SalesPrintSheet so={so} type={printState.type} />}

      <SalesDetailShell
        backHref={routes.eCommerce.salesQuotations}
        backLabel="Quotations"
        eyebrow="Quotation"
        soNumber={so.soNumber}
        createdAt={so.createdAt}
        statusPill={sc}
        total={fmtCur(so.total, so.currency)}
        banner={
          expiry.state !== 'ok' ? (
            <ExpiryBanner
              state={expiry.state}
              daysLeft={expiry.daysLeft}
              until={so.validUntil ?? ''}
            />
          ) : undefined
        }
        totalSubline={
          <p className="text-white/40">
            {lineCount} line{lineCount === 1 ? '' : 's'}
            {so.validUntil ? ` · valid until ${fmtDate(so.validUntil)}` : ''}
          </p>
        }
        actions={actions}
        customer={{
          name: so.customerSnapshot?.name ?? 'Walk-in Customer',
          phone: so.customerSnapshot?.phone,
          email: so.customerSnapshot?.email,
        }}
      >
        <SalesQuotationDetailInfo so={so} />
        <SalesQuotationDetailLines so={so} />
      </SalesDetailShell>
    </>
  );
}
