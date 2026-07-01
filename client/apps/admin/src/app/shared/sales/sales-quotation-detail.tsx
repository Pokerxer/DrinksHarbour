'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiPaperPlaneTilt,
  PiCheck,
  PiX,
  PiArrowsClockwise,
  PiPencilSimple,
  PiPrinter,
  PiCaretRight,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService, type SalesOrder } from '@/services/salesOrder.service';
import { quoteStatusLabel, fmtDate } from './sales-helpers';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import SalesPrintSheet, { type PrintSheetType } from './sales-print-sheet';
import SalesQuotationDetailInfo from './sales-quotation-detail-info';
import SalesQuotationDetailLines from './sales-quotation-detail-lines';

const QUOTE_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  draft: { label: 'Draft', bg: '#f4f4f5', color: '#52525b', dot: '#a1a1aa' },
  sent: { label: 'Sent', bg: '#eff6ff', color: '#1d4ed8', dot: '#3b82f6' },
  accepted: { label: 'Accepted', bg: '#f0fdf4', color: '#15803d', dot: '#22c55e' },
  rejected: { label: 'Rejected', bg: '#fef2f2', color: '#b91c1c', dot: '#ef4444' },
  expired: { label: 'Expired', bg: '#fffbeb', color: '#92400e', dot: '#f59e0b' },
  converted: { label: 'Converted', bg: '#f5f3ff', color: '#6d28d9', dot: '#8b5cf6' },
};

export default function SalesQuotationDetail({
  so,
  onChanged,
}: {
  so: SalesOrder;
  onChanged: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [busy, setBusy] = useState(false);
  const [printState, setPrintState] = useState<{ type: PrintSheetType } | null>(null);

  async function run(action: () => Promise<{ data: SalesOrder }>, successMsg: string, redirectToResult = false) {
    setBusy(true);
    try {
      const res = await action();
      toast.success(successMsg);
      if (redirectToResult) router.push(routes.eCommerce.salesDetails(res.data._id));
      else onChanged();
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

  const status = so.quoteStatus ?? 'draft';
  const canEdit = status === 'draft' || status === 'sent';

  const customerName = so.customerSnapshot?.name ?? 'Walk-in Customer';
  const customerInitial = customerName.charAt(0).toUpperCase();
  const sc = QUOTE_STATUS_CONFIG[status] ?? QUOTE_STATUS_CONFIG.draft;

  return (
    <div className="min-h-screen bg-gray-50">
      {printState && <SalesPrintSheet so={so} type={printState.type} />}

      <nav className="mb-5 flex items-center gap-1.5 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesQuotations} className="transition-colors hover:text-gray-700">
          Quotations
        </Link>
        <PiCaretRight className="h-3 w-3 text-gray-300" />
        <span className="font-medium text-gray-900">{so.soNumber}</span>
      </nav>

      <div className="flex items-start gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brand">Quotation</p>
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">{so.soNumber}</h1>
                <p className="mt-1 text-sm text-gray-400">{fmtDate(so.createdAt)}</p>
              </div>
              <span
                className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{ background: sc.bg, color: sc.color }}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc.dot }} />
                {sc.label}
              </span>
            </div>
          </div>

          <SalesQuotationDetailInfo so={so} />
          <SalesQuotationDetailLines so={so} />
        </div>

        <aside className="sticky top-6 w-[17rem] shrink-0 self-start overflow-hidden rounded-2xl bg-[#0f0e13] print:hidden">
          <div className="p-6">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Total Amount</p>
            <p className="text-[2.25rem] font-bold leading-none text-white" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
              {fmtCur(so.total, so.currency)}
            </p>
            <p className="mt-2 text-xs text-white/40">
              {so.items.filter((i) => i.lineType !== 'section' && i.lineType !== 'note').length} line(s)
            </p>

            <div className="my-5 h-px bg-white/[0.08]" />

            <div className="space-y-2">
              {status === 'draft' && (
                <button type="button" disabled={busy}
                  onClick={() => run(() => salesOrderService.send(so._id, token), 'Quotation sent')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50">
                  <PiPaperPlaneTilt className="h-4 w-4" /> Send to Customer
                </button>
              )}
              {status === 'sent' && (
                <button type="button" disabled={busy}
                  onClick={() => run(() => salesOrderService.accept(so._id, token), 'Quotation accepted')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50">
                  <PiCheck className="h-4 w-4" /> Accept Quote
                </button>
              )}
              {status === 'accepted' && (
                <button type="button" disabled={busy}
                  onClick={() => run(() => salesOrderService.convert(so._id, token), 'Converted to order', true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-brand-dark active:scale-[0.98] disabled:opacity-50">
                  <PiArrowsClockwise className="h-4 w-4" /> Convert to Order
                </button>
              )}
              {canEdit && (
                <Link href={routes.eCommerce.salesEdit(so._id)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white">
                  <PiPencilSimple className="h-4 w-4" /> Edit
                </Link>
              )}
              {status === 'sent' && (
                <button type="button" disabled={busy}
                  onClick={() => run(() => salesOrderService.reject(so._id, token), 'Quotation rejected')}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/50 ring-1 ring-white/10 transition-all hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50">
                  <PiX className="h-4 w-4" /> Reject
                </button>
              )}
              <button type="button" onClick={() => handlePrint('quotation')}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white/80 ring-1 ring-white/10 transition-all hover:bg-white/10 hover:text-white">
                <PiPrinter className="h-4 w-4" /> Print
              </button>
            </div>
          </div>

          {so.customerSnapshot?.name && (
            <div className="border-t border-white/[0.08] p-6">
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Customer</p>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{customerInitial}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{customerName}</p>
                  {so.customerSnapshot?.phone && <p className="mt-0.5 text-xs text-white/40">{so.customerSnapshot.phone}</p>}
                  {so.customerSnapshot?.email && (
                    <a href={`mailto:${so.customerSnapshot.email}`}
                      className="mt-0.5 block text-xs text-brand transition-colors hover:text-[#e03030]">Send message</a>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-white/[0.06] px-6 py-3">
            <p className="font-mono text-[10px] text-white/20">{so.soNumber}</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
