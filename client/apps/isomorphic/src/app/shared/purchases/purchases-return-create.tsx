'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { PiArrowLeft, PiCheck } from 'react-icons/pi';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import type { POItem } from '@/services/purchaseOrder.service';
import { vendorReturnService } from '@/services/vendorReturn.service';

const REASONS = [
  { value: 'defective', label: 'Defective / Faulty' },
  { value: 'wrong_item', label: 'Wrong Item Delivered' },
  { value: 'overdelivery', label: 'Overdelivery' },
  { value: 'damaged', label: 'Damaged in Transit' },
  { value: 'other', label: 'Other' },
];

interface RowState {
  returnQty: number;
  reason: string;
}

export default function PurchasesReturnCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const poId = searchParams.get('po') ?? '';

  const [po, setPo] = useState<
    | Awaited<ReturnType<typeof purchaseOrderService.getPurchaseOrder>>['data']
    | null
  >(null);
  const [rows, setRows] = useState<RowState[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadPO = useCallback(async () => {
    if (!token || !poId) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getPurchaseOrder(poId, token);
      setPo(res.data);
      setRows(
        (res.data.items ?? []).map(() => ({
          returnQty: 0,
          reason: 'defective',
        }))
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load PO');
    } finally {
      setLoading(false);
    }
  }, [poId, token]);

  useEffect(() => {
    loadPO();
  }, [loadPO]);

  function updateRow(i: number, patch: Partial<RowState>) {
    setRows((prev) =>
      prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
    );
  }

  function maxQty(item: POItem): number {
    return item.receivedQty > 0 ? item.receivedQty : item.quantity;
  }

  async function handleCreate() {
    if (!po) return;
    const items = (po.items ?? [])
      .map((item: POItem, i: number) => ({ item, row: rows[i] }))
      .filter(({ row }) => row.returnQty > 0)
      .map(({ item, row }) => ({
        subProductId: item.subProductId,
        subProductName: item.productName,
        sku: item.sku,
        sizeId: item.sizeId,
        sizeName: item.sizeName,
        quantity: row.returnQty,
        unitPrice: item.unitPrice,
        amount: row.returnQty * item.unitPrice,
        reason: row.reason,
      }));

    if (items.length === 0) {
      toast.error('Set a return quantity > 0 for at least one item');
      return;
    }

    setSaving(true);
    try {
      const res = await vendorReturnService.createVendorReturn(
        {
          vendor: po.vendor,
          vendorName: po.vendorName,
          purchaseOrder: po._id,
          poNumber: po.poNumber,
          currency: po.currency ?? 'NGN',
          items,
          reason: items[0].reason,
          notes,
          returnDate: new Date().toISOString(),
        },
        token
      );
      toast.success('Return created');
      router.push(routes.eCommerce.vendorReturnDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create return'
      );
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
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.vendorReturns}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Vendor Returns
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Return</span>
      </div>

      <h1 className="mb-5 text-xl font-semibold text-gray-900">
        Create Vendor Return
      </h1>

      {!poId && (
        <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          Navigate here from a received Purchase Order to auto-populate return
          lines. Append <code className="font-mono">?po=&lt;id&gt;</code> to the
          URL.
        </div>
      )}

      {po && (
        <>
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Purchase Order</p>
            <p className="font-medium text-gray-900">{po.poNumber}</p>
            {po.vendorName && (
              <p className="text-sm text-gray-600">{po.vendorName}</p>
            )}
          </div>

          <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-5 py-3">
              <h2 className="text-sm font-semibold text-gray-700">
                Items to Return
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Received
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Return Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(po.items ?? []).map((item: POItem, i: number) => {
                  const max = maxQty(item);
                  const row = rows[i] ?? { returnQty: 0, reason: 'defective' };
                  return (
                    <tr
                      key={i}
                      className={row.returnQty > 0 ? 'bg-red-50' : ''}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {item.productName}
                        </p>
                        {item.sku && (
                          <p className="text-xs text-gray-500">{item.sku}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {max}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={max}
                          value={row.returnQty}
                          onChange={(e) =>
                            updateRow(i, {
                              returnQty: Math.min(
                                max,
                                Math.max(0, parseInt(e.target.value) || 0)
                              ),
                            })
                          }
                          className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {po.currency} {item.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={row.reason}
                          onChange={(e) =>
                            updateRow(i, { reason: e.target.value })
                          }
                          disabled={row.returnQty === 0}
                          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-[#b20202] focus:outline-none disabled:opacity-40"
                        >
                          {REASONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {row.returnQty > 0
                          ? `${po.currency} ${(row.returnQty * item.unitPrice).toFixed(2)}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Link
              href={routes.eCommerce.vendorReturns}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
            >
              <PiCheck className="h-4 w-4" />
              {saving ? 'Creating…' : 'Create Return'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
