'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { PiArrowLeft, PiCheck, PiWarning } from 'react-icons/pi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { POItem } from '@/services/purchaseOrder.service';
import BaseCurrencyEquivalent from './base-currency-equivalent';

type BillableLine = {
  subProductName: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  amount: number;
  tax: number;
  total: number;
};

export default function PurchasesBillCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const poId = searchParams.get('po') ?? '';

  const [po, setPo] = useState<
    | Awaited<ReturnType<typeof purchaseOrderService.getPurchaseOrder>>['data']
    | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billDate, setBillDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  // null until the user picks; falls back to the PO's own billing policy
  const [policyOverride, setPolicyOverride] = useState<
    'ordered' | 'received' | null
  >(null);

  const load = useCallback(async () => {
    if (!token || !poId) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrder(poId, token);
      setPo(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load PO');
    } finally {
      setLoading(false);
    }
  }, [poId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const policy = policyOverride ?? po?.billControlPolicy ?? 'received';
  const poBillable =
    !!po && ['confirmed', 'received', 'validated'].includes(po.status);

  const lines: BillableLine[] = (po?.items ?? [])
    .filter((item: POItem) =>
      policy === 'received' ? (item.receivedQty ?? 0) > 0 : item.quantity > 0
    )
    .map((item: POItem) => {
      const qty =
        policy === 'received' ? (item.receivedQty ?? 0) : item.quantity;
      const unitPrice = item.unitCost ?? item.unitPrice ?? 0;
      const taxRate = item.taxRate ?? 0;
      const amount = qty * unitPrice;
      const tax = amount * (taxRate / 100);
      return {
        subProductName: item.subProductName ?? item.productName ?? item.sku,
        sku: item.sku,
        quantity: qty,
        unitPrice,
        taxRate,
        amount,
        tax,
        total: amount + tax,
      };
    });

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const taxTotal = lines.reduce((s, l) => s + l.tax, 0);
  const grandTotal = subtotal + taxTotal;

  async function handleCreate() {
    if (!poId) {
      toast.error('No purchase order selected');
      return;
    }
    if (lines.length === 0) {
      toast.error(
        policy === 'received'
          ? 'No received items to bill — receive goods or switch to ordered quantities'
          : 'No billable items on this PO'
      );
      return;
    }
    setSaving(true);
    try {
      const res = await purchaseOrderService.createBillFromPO(poId, token, {
        billDate,
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        billControlPolicy: policy,
      });
      toast.success('Vendor bill created');
      router.push(routes.eCommerce.vendorBillDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create bill');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-gray-400">
        Loading…
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.vendorBills}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Vendor Bills
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Bill</span>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Create Vendor Bill
        </h1>
      </div>

      {/* No PO warning */}
      {!poId && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Navigate here from a received Purchase Order. Append{' '}
            <code className="font-mono">?po=&lt;id&gt;</code> to the URL.
          </span>
        </div>
      )}

      {po && !poBillable && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <PiWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This purchase order is <strong>{po.status}</strong> — it must be
            confirmed before it can be billed.{' '}
            <Link
              href={routes.eCommerce.purchaseDetails(po._id)}
              className="font-medium underline"
            >
              Open {po.poNumber}
            </Link>
          </span>
        </div>
      )}

      {po && (
        <div className="space-y-5">
          {/* PO summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Purchase Order', value: po.poNumber },
              { label: 'Vendor', value: po.vendorName ?? '—' },
              { label: 'Currency', value: po.currency ?? 'NGN' },
              { label: 'PO Status', value: po.status ?? '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-0.5 truncate font-medium capitalize text-gray-900">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* Bill lines preview */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-700">
                  Bill Lines —{' '}
                  {policy === 'received'
                    ? 'Received Quantities'
                    : 'Ordered Quantities'}
                </h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {policy === 'received'
                    ? 'Bills what has actually been received so far.'
                    : 'Bills the full ordered quantities, even before receipt.'}
                </p>
              </div>
              <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs font-medium">
                {(['received', 'ordered'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPolicyOverride(p)}
                    className={`rounded-md px-3 py-1.5 capitalize transition-colors ${
                      policy === p
                        ? 'bg-[#b20202] text-white'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {lines.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-8 text-sm text-amber-700">
                <PiWarning className="h-5 w-5 shrink-0 text-amber-500" />
                {policy === 'received' ? (
                  <span>
                    No received items on this PO yet. Receive goods first, or
                    switch to <strong>ordered</strong> to bill the full order
                    now.
                  </span>
                ) : (
                  <span>No billable items on this purchase order.</span>
                )}
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                        Unit Cost
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                        Tax %
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                        Tax
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lines.map((line, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {line.subProductName}
                          </p>
                          {line.sku && (
                            <p className="text-xs text-gray-400">{line.sku}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {line.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">
                          {po.currency} {line.unitPrice.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {line.taxRate}%
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">
                          {po.currency} {line.tax.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {po.currency} {line.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                  <div className="ml-auto max-w-xs space-y-1.5 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>
                        {po.currency} {subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Tax</span>
                      <span>
                        {po.currency} {taxTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                      <span>Total</span>
                      <span>
                        {po.currency} {grandTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <BaseCurrencyEquivalent
                        amount={grandTotal}
                        currency={po.currency}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Bill metadata */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-700">
              Bill Details
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Bill Date *
                </label>
                <input
                  type="date"
                  value={billDate}
                  onChange={(e) => setBillDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  min={billDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Internal notes for this bill…"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href={routes.eCommerce.vendorBills}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || lines.length === 0 || !poBillable}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-5 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" />
              {saving
                ? 'Creating…'
                : `Create Bill · ${po.currency} ${grandTotal.toFixed(2)}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
