'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiCheck,
  PiX,
  PiTrash,
  PiPlus,
  PiShoppingCart,
  PiTrophy,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseAgreementService } from '@/services/purchaseAgreement.service';
import type { PurchaseAgreement, AgreementItem } from './types';
import {
  STATUS_BADGE,
  AGREEMENT_STATUS_LABEL,
  AGREEMENT_TYPE_LABEL,
  CURRENCY_SYMBOLS,
  statusLabel,
} from './types';
import BaseCurrencyEquivalent from './base-currency-equivalent';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

function fmtDate(d?: string) {
  return d ? new Date(d).toLocaleDateString() : '—';
}

function remaining(item: AgreementItem) {
  return Math.max(0, item.quantity - (item.consumedQuantity ?? 0));
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div
        className="h-2 rounded-full bg-[#b20202] transition-all"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export default function PurchasesAgreementDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [agreement, setAgreement] = useState<PurchaseAgreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Create-PO modal state: subProductId → quantity to order
  const [poModalOpen, setPoModalOpen] = useState(false);
  const [poQty, setPoQty] = useState<Record<string, number>>({});
  const [poVendorRef, setPoVendorRef] = useState('');
  const [poArrival, setPoArrival] = useState('');
  const [poNotes, setPoNotes] = useState('');

  // Tender response form state
  const [responseFormOpen, setResponseFormOpen] = useState(false);
  const [respVendorName, setRespVendorName] = useState('');
  const [respAmount, setRespAmount] = useState('');
  const [respDelivery, setRespDelivery] = useState('');
  const [respValidity, setRespValidity] = useState('');
  const [respNotes, setRespNotes] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseAgreementService.getAgreement(id, token);
      if (!res.success) throw new Error('Agreement not found');
      setAgreement(res.data as unknown as PurchaseAgreement);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(
    fn: () => Promise<{ success: boolean; message?: string }>,
    msg: string
  ) {
    setActing(true);
    try {
      const res = await fn();
      if (!res.success) throw new Error(res.message || 'Action failed');
      toast.success(msg);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    if (!agreement) return;
    if (
      !confirm(
        `Delete agreement ${agreement.agreementNumber}? This cannot be undone.`
      )
    )
      return;
    setActing(true);
    try {
      const res = await purchaseAgreementService.deleteAgreement(id, token);
      if (!res.success) throw new Error(res.message || 'Failed to delete');
      toast.success('Agreement deleted');
      router.push(routes.eCommerce.purchaseAgreements);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
      setActing(false);
    }
  }

  function openPoModal() {
    if (!agreement?.items) return;
    const initial: Record<string, number> = {};
    agreement.items.forEach((it) => {
      initial[it.subProductId] = remaining(it);
    });
    setPoQty(initial);
    setPoVendorRef('');
    setPoArrival('');
    setPoNotes('');
    setPoModalOpen(true);
  }

  async function handleCreatePO() {
    if (!agreement?.items) return;
    const poItems = agreement.items
      .filter((it) => (poQty[it.subProductId] ?? 0) > 0)
      .map((it) => ({
        subProductId: it.subProductId,
        subProductName: it.subProductName,
        sku: it.sku,
        sizeId: it.sizeId,
        sizeName: it.sizeName,
        quantity: poQty[it.subProductId],
        unitCost: it.unitPrice,
      }));
    if (poItems.length === 0) {
      toast.error('Enter a quantity for at least one item');
      return;
    }
    const over = agreement.items.find(
      (it) => (poQty[it.subProductId] ?? 0) > remaining(it)
    );
    if (over) {
      toast.error(
        `${over.subProductName}: only ${remaining(over)} remaining on this agreement`
      );
      return;
    }
    setActing(true);
    try {
      const res = await purchaseAgreementService.createPOFromAgreement(
        id,
        {
          items: poItems,
          vendorReference: poVendorRef.trim() || undefined,
          expectedArrival: poArrival || undefined,
          notes: poNotes.trim() || undefined,
        },
        token
      );
      if (!res.success || !res.data?._id) {
        throw new Error(res.message || 'Failed to create PO');
      }
      toast.success('Purchase order created from agreement');
      router.push(routes.eCommerce.purchaseDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create PO');
      setActing(false);
    }
  }

  async function handleAddResponse() {
    if (!respVendorName.trim()) {
      toast.error('Vendor name is required');
      return;
    }
    await act(
      () =>
        purchaseAgreementService.addTenderResponse(
          id,
          {
            vendorName: respVendorName.trim(),
            totalAmount: respAmount ? Number(respAmount) : undefined,
            currency: agreement?.currency,
            deliveryDate: respDelivery || undefined,
            validityDate: respValidity || undefined,
            notes: respNotes.trim() || undefined,
          },
          token
        ),
      'Tender response recorded'
    );
    setResponseFormOpen(false);
    setRespVendorName('');
    setRespAmount('');
    setRespDelivery('');
    setRespValidity('');
    setRespNotes('');
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    );
  if (!agreement)
    return (
      <div className="py-20 text-center text-sm text-gray-500">
        Agreement not found
      </div>
    );

  const isTender = agreement.agreementType === 'call_for_tender';
  const symbol = CURRENCY_SYMBOLS[agreement.currency] ?? '';
  const totalAmount = agreement.totalAmount ?? 0;
  const consumedAmount = agreement.consumedAmount ?? 0;
  const totalQuantity = agreement.totalQuantity ?? 0;
  const consumedQuantity = agreement.consumedQuantity ?? 0;
  const amountPct = totalAmount > 0 ? (consumedAmount / totalAmount) * 100 : 0;
  const qtyPct =
    totalQuantity > 0 ? (consumedQuantity / totalQuantity) * 100 : 0;
  const vendorObj =
    typeof agreement.vendor === 'object' ? agreement.vendor : null;
  const hasWinner = (agreement.tenderResponses ?? []).some(
    (r) => r.status === 'accepted'
  );
  const canCreatePO = agreement.status === 'active' && (!isTender || hasWinner);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.purchaseAgreements}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Purchase Agreements
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">
          {agreement.agreementNumber}
        </span>
      </div>

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {agreement.agreementNumber}
            </h1>
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[agreement.status] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {AGREEMENT_STATUS_LABEL[agreement.status] ?? agreement.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {agreement.name} ·{' '}
            {AGREEMENT_TYPE_LABEL[agreement.agreementType] ?? '—'}
            {agreement.vendorName ? ` · ${agreement.vendorName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {agreement.status === 'draft' && (
            <button
              type="button"
              disabled={acting}
              onClick={() =>
                act(
                  () => purchaseAgreementService.activateAgreement(id, token),
                  'Agreement activated'
                )
              }
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" /> Activate
            </button>
          )}
          {canCreatePO && (
            <button
              type="button"
              disabled={acting}
              onClick={openPoModal}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiShoppingCart className="h-4 w-4" /> Create PO
            </button>
          )}
          {['draft', 'active'].includes(agreement.status) && (
            <button
              type="button"
              disabled={acting}
              onClick={() => {
                if (confirm('Cancel this agreement?'))
                  act(
                    () => purchaseAgreementService.cancelAgreement(id, token),
                    'Agreement cancelled'
                  );
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <PiX className="h-4 w-4" /> Cancel
            </button>
          )}
          {agreement.status === 'draft' && (
            <button
              type="button"
              disabled={acting}
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <PiTrash className="h-4 w-4" /> Delete
            </button>
          )}
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          {
            label: 'Vendor',
            value: agreement.vendorName ?? '—',
            sub: vendorObj?.email,
          },
          {
            label: 'Period',
            value: `${fmtDate(agreement.startDate)} → ${fmtDate(agreement.endDate)}`,
          },
          {
            label: 'Total Value',
            value:
              totalAmount > 0
                ? `${symbol}${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : '—',
            sub: agreement.currency,
          },
          {
            label: 'Approved',
            value: agreement.approvedAt ? fmtDate(agreement.approvedAt) : '—',
          },
        ].map(({ label, value, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-200 bg-white p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 font-medium text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400">{sub}</p>}
          </div>
        ))}
      </div>

      {/* Consumption */}
      {agreement.status !== 'draft' && totalQuantity > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-gray-500">
                Quantity Consumed
              </span>
              <span className="text-gray-600">
                {consumedQuantity.toLocaleString()} /{' '}
                {totalQuantity.toLocaleString()} ({qtyPct.toFixed(0)}%)
              </span>
            </div>
            <ProgressBar pct={qtyPct} />
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-gray-500">Amount Consumed</span>
              <span className="text-gray-600">
                {symbol}
                {consumedAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                / {symbol}
                {totalAmount.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                ({amountPct.toFixed(0)}%)
              </span>
            </div>
            <ProgressBar pct={amountPct} />
          </div>
        </div>
      )}

      {/* Items */}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Agreed Products
          </h2>
        </div>
        {(agreement.items ?? []).length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No products on this agreement
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">
                    Product
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                    Agreed Qty
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                    Consumed
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                    Remaining
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                    Unit Price
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                    Total
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                    Lead Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(agreement.items ?? []).map((it, i) => (
                  <tr key={`${it.subProductId}-${i}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {it.subProductName}
                      </p>
                      {it.sku && (
                        <p className="font-mono text-xs text-gray-400">
                          {it.sku}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {it.quantity.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {(it.consumedQuantity ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {remaining(it).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {symbol}
                      {it.unitPrice.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {symbol}
                      {(
                        it.totalPrice ?? it.quantity * it.unitPrice
                      ).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {it.leadTimeDays ?? 0}d
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50 text-sm font-semibold">
                  <td className="px-4 py-3 text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    {totalQuantity.toLocaleString()}
                  </td>
                  <td colSpan={3} />
                  <td className="px-4 py-3 text-right text-gray-900">
                    {symbol}
                    {totalAmount.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                    <BaseCurrencyEquivalent
                      amount={totalAmount}
                      currency={agreement.currency}
                      className="font-normal"
                    />
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Tender responses */}
      {isTender && (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Tender Responses
            </h2>
            {['draft', 'active'].includes(agreement.status) && (
              <button
                type="button"
                onClick={() => setResponseFormOpen((v) => !v)}
                className="flex items-center gap-1 text-sm font-medium text-[#b20202] hover:underline"
              >
                <PiPlus className="h-4 w-4" /> Record response
              </button>
            )}
          </div>
          {responseFormOpen && (
            <div className="grid grid-cols-1 gap-3 border-b border-gray-100 bg-gray-50/50 p-4 sm:grid-cols-5">
              <input
                value={respVendorName}
                onChange={(e) => setRespVendorName(e.target.value)}
                placeholder="Vendor name *"
                className={INPUT_CLS}
              />
              <input
                type="number"
                min="0"
                value={respAmount}
                onChange={(e) => setRespAmount(e.target.value)}
                placeholder={`Bid total (${symbol})`}
                className={INPUT_CLS}
              />
              <input
                type="date"
                value={respDelivery}
                onChange={(e) => setRespDelivery(e.target.value)}
                title="Proposed delivery date"
                className={INPUT_CLS}
              />
              <input
                type="date"
                value={respValidity}
                onChange={(e) => setRespValidity(e.target.value)}
                title="Bid valid until"
                className={INPUT_CLS}
              />
              <div className="flex gap-2">
                <input
                  value={respNotes}
                  onChange={(e) => setRespNotes(e.target.value)}
                  placeholder="Notes"
                  className={INPUT_CLS}
                />
                <button
                  type="button"
                  disabled={acting}
                  onClick={handleAddResponse}
                  className="shrink-0 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          )}
          {(agreement.tenderResponses ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-500">
              No vendor responses yet
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-xs">
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">
                    Vendor
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-gray-500">
                    Bid Total
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">
                    Delivery
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">
                    Valid Until
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(agreement.tenderResponses ?? []).map((r, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {r.vendorName}
                      </p>
                      {r.notes && (
                        <p className="text-xs text-gray-500">{r.notes}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.totalAmount != null
                        ? `${symbol}${r.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fmtDate(r.deliveryDate)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fmtDate(r.validityDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status ?? 'pending'] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {statusLabel(r.status ?? 'pending')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'pending' &&
                        ['draft', 'active'].includes(agreement.status) && (
                          <button
                            type="button"
                            disabled={acting}
                            onClick={() => {
                              if (
                                confirm(
                                  `Select ${r.vendorName} as the winning vendor?`
                                )
                              )
                                act(
                                  () =>
                                    purchaseAgreementService.selectTenderWinner(
                                      id,
                                      {
                                        vendorIndex: i,
                                        vendorId: r.vendorId,
                                      },
                                      token
                                    ),
                                  `${r.vendorName} selected as winner`
                                );
                            }}
                            title="Select as winner"
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <PiTrophy className="h-3.5 w-3.5" /> Select winner
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Linked POs */}
      {(agreement.purchaseOrders ?? []).length > 0 && (
        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Purchase Orders from this Agreement
            </h2>
          </div>
          <div className="divide-y divide-gray-100">
            {(agreement.purchaseOrders ?? []).map((po) => (
              <Link
                key={po._id}
                href={routes.eCommerce.purchaseDetails(po._id)}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="font-mono text-sm font-medium text-gray-900">
                  {po.poNumber ?? po._id}
                </span>
                <div className="flex items-center gap-3">
                  {po.totalAmount != null && (
                    <span className="text-sm text-gray-600">
                      {symbol}
                      {po.totalAmount.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  )}
                  {po.status && (
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[po.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {statusLabel(po.status)}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Terms & notes */}
      {(agreement.termsConditions || agreement.notes) && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {agreement.termsConditions && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">
                Terms & Conditions
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {agreement.termsConditions}
              </p>
            </div>
          )}
          {agreement.notes && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {agreement.notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Create PO modal */}
      {poModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                Create Purchase Order from {agreement.agreementNumber}
              </h2>
              <button
                type="button"
                onClick={() => setPoModalOpen(false)}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <PiX className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              Quantities default to what's remaining on each agreement line.
              Prices come from the agreement.
            </p>
            <div className="space-y-2">
              {(agreement.items ?? []).map((it) => {
                const rem = remaining(it);
                return (
                  <div
                    key={it.subProductId}
                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {it.subProductName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {rem.toLocaleString()} remaining · {symbol}
                        {it.unitPrice.toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{' '}
                        each
                      </p>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={rem}
                      value={poQty[it.subProductId] ?? 0}
                      disabled={rem === 0}
                      onChange={(e) =>
                        setPoQty((prev) => ({
                          ...prev,
                          [it.subProductId]: Number(e.target.value),
                        }))
                      }
                      className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-[#b20202] focus:outline-none disabled:bg-gray-100"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Vendor Reference
                </label>
                <input
                  value={poVendorRef}
                  onChange={(e) => setPoVendorRef(e.target.value)}
                  placeholder="Vendor's quote/order ref"
                  className={INPUT_CLS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Expected Arrival
                </label>
                <input
                  type="date"
                  value={poArrival}
                  onChange={(e) => setPoArrival(e.target.value)}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                  rows={2}
                  className={INPUT_CLS}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPoModalOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={handleCreatePO}
                className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
              >
                <PiShoppingCart className="h-4 w-4" />
                {acting ? 'Creating…' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
