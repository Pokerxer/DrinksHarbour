// client/apps/isomorphic/src/app/shared/sales/sales-create.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  PiArrowLeft,
  PiCheck,
  PiFloppyDisk,
  PiPlus,
  PiTrash,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { salesOrderService } from '@/services/salesOrder.service';
import type { POSCustomer } from '@/app/shared/point-of-sale/types';
import type { POSCartItem } from '@/app/shared/point-of-sale/types';
import { computeItemPriceWithPricelist } from '@/app/shared/point-of-sale/store';
import { fmtCur } from '../purchases/purchases-analytics-helpers';
import CustomerSearch from './customer-search';
import ProductLineSearch, {
  type ProductLineSelection,
} from './product-line-search';
import { useSalesCustomerPricelist } from './use-sales-customer-pricelist';

const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20';

const INLINE_CELL_CLS =
  'w-full border-0 border-b border-transparent bg-transparent px-1 py-1 text-right text-sm text-gray-900 focus:border-[#b20202] focus:outline-none focus:ring-0';

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
  taxRate: number;
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
    taxRate: 0,
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

type CreateTab = 'lines' | 'other';

/** Non-interactive lifecycle-stage indicator — visual parity only, no click behavior. */
function StagePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-[#b20202]/10 text-[#b20202]' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {label}
    </span>
  );
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
  const [tab, setTab] = useState<CreateTab>('lines');

  const today = useMemo(
    () => new Date().toLocaleDateString(undefined, { dateStyle: 'medium' }),
    []
  );

  const { selected: pricelist, resolvedId } = useSalesCustomerPricelist(
    token,
    customer?._id ?? ''
  );

  const updateLine = useCallback((key: string, patch: Partial<DraftLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    );
  }, []);

  const addLine = useCallback(() => setLines((p) => [...p, blankLine()]), []);
  const removeLine = useCallback(
    (key: string) => setLines((p) => p.filter((l) => l.key !== key)),
    []
  );

  const priced = useMemo(
    () =>
      lines.map((l) => {
        const unitPrice = liveUnitPrice(l, pricelist);
        const lineTotal = lineTotalOf(unitPrice, l.discount, l.quantity);
        return {
          ...l,
          unitPrice,
          lineTotal,
          taxAmount: Math.round(lineTotal * (Math.max(0, l.taxRate) / 100)),
        };
      }),
    [lines, pricelist]
  );

  // Odoo-style totals: Untaxed Amount + Tax = Total (tax-exclusive).
  const untaxedAmount = priced.reduce((s, l) => s + l.lineTotal, 0);
  const taxTotal = priced.reduce((s, l) => s + l.taxAmount, 0);
  const grandTotal = untaxedAmount + taxTotal;
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
            ? {
                name: `${customer.firstName} ${customer.lastName}`.trim(),
                phone: customer.phone,
                email: customer.email,
                customerId: customer._id,
              }
            : undefined,
          pricelist: resolvedId ?? undefined,
          appliedPricelist: pricelist
            ? { pricelistId: pricelist._id, pricelistName: pricelist.name }
            : undefined,
          items: filled.map((l) => ({
            product: l.product,
            subproduct: l.subProductId,
            size: l.sizeId,
            sku: l.sku,
            name: l.name,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            taxRate: l.taxRate,
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
      <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
        <Link
          href={routes.eCommerce.salesOrders}
          className="flex items-center gap-1 hover:text-gray-700"
        >
          <PiArrowLeft className="h-4 w-4" /> Sales
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">New Sale</span>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">New</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Save as a quotation or create the order directly.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
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
            <Link
              href={routes.eCommerce.salesOrders}
              className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <StagePill label="Quotation" active />
            <StagePill label="Quotation Sent" active={false} />
            <StagePill label="Sales Order" active={false} />
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-x-10 gap-y-5 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-gray-600">
            Customer
          </label>
          <CustomerSearch
            token={token}
            selected={customer}
            onSelect={setCustomer}
            onClear={() => setCustomer(null)}
          />
          {pricelist && (
            <p className="mt-2 text-xs text-emerald-600">
              Pricelist &quot;{pricelist.name}&quot; auto-applied from this
              customer.
            </p>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Quotation Date
            </label>
            <p className="rounded-lg border border-transparent px-3 py-2 text-sm text-gray-700">
              {today}
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">
              Expiration
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className={INPUT_CLS}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex border-b border-gray-200 px-4">
          <button
            type="button"
            onClick={() => setTab('lines')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              tab === 'lines'
                ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Order Lines
          </button>
          <button
            type="button"
            onClick={() => setTab('other')}
            className={`relative px-3 py-3 text-sm font-medium transition-colors ${
              tab === 'other'
                ? 'text-[#b20202] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-[#b20202]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Other Info
          </button>
        </div>

        <div className="p-5">
          {tab === 'lines' ? (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-2 py-2 text-left text-xs font-medium text-gray-500">
                      Product
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Qty
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Unit Price
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Discount
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Tax %
                    </th>
                    <th className="px-2 py-2 text-right text-xs font-medium text-gray-500">
                      Line Total
                    </th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {priced.map((line) => (
                    <tr key={line.key}>
                      <td className="px-2 py-2">
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
                              taxRate: info.taxRate,
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, {
                              quantity: Math.max(
                                1,
                                Number(e.target.value) || 1
                              ),
                            })
                          }
                          className={`${INLINE_CELL_CLS} w-16`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-medium text-gray-900">
                        {fmtCur(line.unitPrice, 'NGN')}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          value={line.discount}
                          onChange={(e) =>
                            updateLine(line.key, {
                              discount: Math.max(
                                0,
                                Number(e.target.value) || 0
                              ),
                            })
                          }
                          className={`${INLINE_CELL_CLS} w-24`}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={line.taxRate}
                          onChange={(e) =>
                            updateLine(line.key, {
                              taxRate: Math.min(
                                100,
                                Math.max(0, Number(e.target.value) || 0)
                              ),
                            })
                          }
                          className={`${INLINE_CELL_CLS} w-16`}
                        />
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-semibold text-gray-900">
                        {fmtCur(line.lineTotal, 'NGN')}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button
                type="button"
                onClick={addLine}
                className="mt-3 flex items-center gap-1.5 text-sm font-medium text-[#b20202] hover:underline"
              >
                <PiPlus className="h-3.5 w-3.5" /> Add a product
              </button>

              <div className="mt-6 flex justify-end border-t border-gray-100 pt-4">
                <div className="w-full max-w-xs space-y-1.5">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Untaxed Amount</span>
                    <span>{fmtCur(untaxedAmount, 'NGN')}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Tax</span>
                    <span>{fmtCur(taxTotal, 'NGN')}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-1.5 text-base font-semibold text-gray-900">
                    <span>Total</span>
                    <span>{fmtCur(grandTotal, 'NGN')}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className={INPUT_CLS}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-gray-600">
                  Terms
                </label>
                <textarea
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  rows={2}
                  className={INPUT_CLS}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
