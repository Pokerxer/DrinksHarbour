'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiPlus, PiTrash, PiMagnifyingGlass, PiFloppyDisk, PiCheck } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { purchaseOrderService } from '@/services/purchaseOrder.service';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from './types';

interface LineItem {
  subProductId: string;
  productName: string;
  sku: string;
  quantity: number;
  packSize: number;
  packQty: number;
  unitPrice: number;
  packPrice: number;
  type: string;
  uom: string;
  taxRate: number;
}

const CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

export default function PurchasesCreate() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [vendorQuery, setVendorQuery] = useState('');
  const [vendorResults, setVendorResults] = useState<Vendor[]>([]);
  const [vendorOpen, setVendorOpen] = useState(false);

  const [currency, setCurrency] = useState('NGN');
  const [expectedArrival, setExpectedArrival] = useState('');
  const [vendorReference, setVendorReference] = useState('');
  const [notes, setNotes] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vendorQuery.trim().length < 2 || !token) {
      setVendorResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const results = await vendorService.search(vendorQuery, token);
        setVendorResults(results);
        setVendorOpen(true);
      } catch {
        setVendorResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [vendorQuery, token]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        subProductId: '',
        productName: '',
        sku: '',
        quantity: 1,
        packSize: 1,
        packQty: 1,
        unitPrice: 0,
        packPrice: 0,
        type: 'unit',
        uom: 'unit',
        taxRate: 0,
      },
    ]);
  }

  function updateItem(index: number, field: keyof LineItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'unitPrice' || field === 'packSize') {
          updated.packPrice = Number(updated.unitPrice) * Number(updated.packSize);
        }
        return updated;
      })
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave(confirm = false) {
    if (items.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor: vendor?._id,
        vendorName: vendor?.name,
        vendorReference,
        currency,
        expectedArrival: expectedArrival || undefined,
        notes,
        termsConditions,
        items: items.map((it) => ({
          ...it,
          receivedQty: 0,
          totalCost: it.unitPrice * it.quantity,
        })),
        status: confirm ? 'confirmed' : 'draft',
      };
      const res = await purchaseOrderService.createPurchaseOrder(payload, token);
      toast.success(confirm ? 'Purchase order confirmed' : 'RFQ saved as draft');
      router.push(routes.eCommerce.purchaseDetails(res.data._id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">New Request for Quotation</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <PiFloppyDisk className="h-4 w-4" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiCheck className="h-4 w-4" />
            Confirm Order
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Order Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative">
              <label className="mb-1 block text-xs font-medium text-gray-600">Vendor</label>
              <div className="relative">
                <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={vendor ? vendor.name : vendorQuery}
                  onChange={(e) => { setVendor(null); setVendorQuery(e.target.value); }}
                  onFocus={() => vendorResults.length > 0 && setVendorOpen(true)}
                  placeholder="Search vendors…"
                  className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
                />
              </div>
              {vendorOpen && vendorResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
                  {vendorResults.map((v) => (
                    <button
                      key={v._id}
                      type="button"
                      onClick={() => { setVendor(v); setVendorQuery(''); setVendorOpen(false); }}
                      className="block w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {v.name}
                      {v.email && <span className="ml-1 text-xs text-gray-400">({v.email})</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Vendor Reference</label>
              <input
                value={vendorReference}
                onChange={(e) => setVendorReference(e.target.value)}
                placeholder="Vendor's PO number"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Expected Arrival</label>
              <input
                type="date"
                value={expectedArrival}
                onChange={(e) => setExpectedArrival(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Terms & Conditions</label>
              <textarea
                value={termsConditions}
                onChange={(e) => setTermsConditions(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-semibold text-gray-700">Order Lines</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <PiPlus className="h-3.5 w-3.5" />
              Add Line
            </button>
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <p className="text-sm text-gray-400">No items yet</p>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
              >
                <PiPlus className="h-3.5 w-3.5" />
                Add first item
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Pack Size</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Unit Price</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Tax %</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Total</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <input
                          value={item.productName}
                          onChange={(e) => updateItem(i, 'productName', e.target.value)}
                          placeholder="Product name"
                          className="w-40 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={item.sku}
                          onChange={(e) => updateItem(i, 'sku', e.target.value)}
                          placeholder="SKU"
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="1" value={item.quantity}
                          onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                          className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="1" value={item.packSize}
                          onChange={(e) => updateItem(i, 'packSize', Number(e.target.value))}
                          className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="0" step="0.01" value={item.unitPrice}
                          onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))}
                          className="w-24 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min="0" max="100" value={item.taxRate}
                          onChange={(e) => updateItem(i, 'taxRate', Number(e.target.value))}
                          className="w-16 rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#b20202] focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-700">
                        {(item.unitPrice * item.quantity * (1 + item.taxRate / 100)).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button" onClick={() => removeItem(i)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <PiTrash className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {items.length > 0 && (
            <div className="border-t border-gray-100 px-5 py-3">
              <div className="flex justify-end text-sm">
                <div className="text-right">
                  <div className="text-gray-500">
                    Subtotal:{' '}
                    <span className="font-medium text-gray-900">
                      {currency} {items.reduce((s, it) => s + it.unitPrice * it.quantity, 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-gray-500">
                    Total (incl. tax):{' '}
                    <span className="font-semibold text-gray-900">
                      {currency}{' '}
                      {items.reduce((s, it) => s + it.unitPrice * it.quantity * (1 + it.taxRate / 100), 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
