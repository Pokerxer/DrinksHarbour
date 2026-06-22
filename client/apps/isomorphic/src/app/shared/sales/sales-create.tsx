// client/apps/isomorphic/src/app/shared/sales/sales-create.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCheck, PiFloppyDisk, PiPlus, PiTrash } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService } from '@/services/salesOrder.service';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import type { POSCartItem } from '@/app/shared/point-of-sale/types';
import { computeItemPriceWithPricelist } from '@/app/shared/point-of-sale/store';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import CustomerSearch from './customer-search';
import ProductLineSearch, { type ProductLineSelection } from './product-line-search';
import { useSalesCustomerPricelist } from './use-sales-customer-pricelist';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

interface DraftLine {
  key: string;
  subProductId: string;
  product?: string;
  name: string;
  sku: string;
  sizeId?: string;
  sizeName?: string;
  quantity: number;
  baseUnitPrice: number;
  discount: number;
  costPrice: number;
}

function blankLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    subProductId: '',
    name: '',
    sku: '',
    quantity: 1,
    baseUnitPrice: 0,
    discount: 0,
    costPrice: 0,
  };
}

/** Live unit price after pricelist rules, via the shared pure pricing function. */
function liveUnitPrice(line: DraftLine, pricelist: any): number {
  if (!line.subProductId || !pricelist) return line.baseUnitPrice;
  const pricingItem: POSCartItem = {
    subProductId: line.subProductId,
    productId: line.product ?? line.subProductId,
    sizeId: line.sizeId,
    name: line.name,
    variant: line.sizeName ?? '',
    sku: line.sku,
    price: line.baseUnitPrice,
    quantity: line.quantity,
    discount: 0,
    stock: 0,
    costPrice: line.costPrice,
  };
  return computeItemPriceWithPricelist(pricingItem, pricelist);
}

function lineTotalOf(unitPrice: number, discount: number, quantity: number) {
  return Math.max(0, unitPrice - discount) * quantity;
}

export default function SalesCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [saving, setSaving] = useState(false);

  const { selected: pricelist, resolvedId } = useSalesCustomerPricelist(token, customer?._id ?? '');

  const updateLine = useCallback((key: string, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);

  const addLine = useCallback(() => setLines((p) => [...p, blankLine()]), []);
  const removeLine = useCallback((key: string) => setLines((p) => p.filter((l) => l.key !== key)), []);

  const priced = useMemo(
    () =>
      lines.map((l) => {
        const unitPrice = liveUnitPrice(l, pricelist);
        return { ...l, unitPrice, lineTotal: lineTotalOf(unitPrice, l.discount, l.quantity) };
      }),
    [lines, pricelist]
  );

  const grandTotal = priced.reduce((s, l) => s + l.lineTotal, 0);
  const hasLines = lines.some((l) => l.subProductId);

  async function handleSave(asOrder: boolean) {
    const filled = priced.filter((l) => l.subProductId);
    if (filled.length === 0) {
      toast.error('Add at least one product line');
      return;
    }
    const badQty = filled.find((l) => !(l.quantity > 0));
    if (badQty) {
      toast.error(`Quantity for "${badQty.name}" must be at least 1`);
      return;
    }
    setSaving(true);
    try {
      const res = await salesOrderService.create(
        {
          docType: asOrder ? 'order' : 'quotation',
          customer: customer?._id,
          customerSnapshot: customer
            ? { name: `${customer.firstName} ${customer.lastName}`.trim(), phone: customer.phone, email: customer.email, customerId: customer._id }
            : undefined,
          pricelist: resolvedId ?? undefined,
          appliedPricelist: pricelist ? { pricelistId: pricelist._id, pricelistName: pricelist.name } : undefined,
          items: filled.map((l) => ({
            product: l.product,
            subproduct: l.subProductId,
            size: l.sizeId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
          validUntil: validUntil || undefined,
          notes: notes || undefined,
          terms: terms || undefined,
        },
        token
      );
      toast.success(asOrder ? 'Order created' : 'Quotation saved');
      router.push(routes.eCommerce.salesDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="pb-24">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.salesOrders} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Sales
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Sale</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">New Sale</h1>
          <p className="mt-0.5 text-sm text-gray-500">Save as a quotation or create the order directly.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving || !hasLines}
            className="flex items-center gap-2 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiCheck className="h-4 w-4" />
            {saving ? 'Saving…' : 'Create Order'}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving || !hasLines}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <PiFloppyDisk className="h-4 w-4" />
            Save as Quotation
          </button>
          <Link href={routes.eCommerce.salesOrders} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Customer</h2>
          <CustomerSearch token={token} selected={customer} onSelect={setCustomer} onClear={() => setCustomer(null)} />
          {pricelist && (
            <p className="mt-2 text-xs text-emerald-600">
              Pricelist &quot;{pricelist.name}&quot; auto-applied from this customer.
            </p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-800">Validity &amp; Notes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Valid Until (quotations)</label>
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className={INPUT_CLS} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={INPUT_CLS} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-gray-600">Terms</label>
              <textarea value={terms} onChange={(e) => setTerms(e.target.value)} rows={2} className={INPUT_CLS} />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Line Items</h2>
            <button type="button" onClick={addLine} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <PiPlus className="h-3.5 w-3.5" /> Add Line
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Discount</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Line Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {priced.map((line) => (
                  <tr key={line.key}>
                    <td className="px-3 py-2">
                      <ProductLineSearch
                        token={token}
                        query={line.name}
                        onSelect={(info: ProductLineSelection) =>
                          updateLine(line.key, {
                            subProductId: info.subProductId,
                            product: info.productId,
                            name: info.name,
                            sku: info.sku,
                            sizeId: info.sizeId,
                            sizeName: info.sizeName,
                            baseUnitPrice: info.sellingPrice,
                            costPrice: info.costPrice,
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">{fmtCur(line.unitPrice, 'NGN')}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        value={line.discount}
                        onChange={(e) => updateLine(line.key, { discount: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-semibold text-gray-900">{fmtCur(line.lineTotal, 'NGN')}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => removeLine(line.key)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600">
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs text-sm">
              <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-base font-semibold text-gray-900">
                <span>Total</span>
                <span>{fmtCur(grandTotal, 'NGN')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
