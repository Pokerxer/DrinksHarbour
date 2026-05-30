'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiPlus, PiMagnifyingGlass, PiArrowClockwise, PiEye } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorBill } from './types';
import { STATUS_BADGE, statusLabel } from './types';

export default function PurchasesBills() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [bills, setBills] = useState<VendorBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorBillService.getVendorBills(token);
      setBills(res.data ?? res.bills ?? []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = bills.filter((b) => {
    const q = search.toLowerCase();
    return !q || b.billNumber?.toLowerCase().includes(q) || b.vendorName?.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Vendor Bills</h1>
          <p className="text-sm text-gray-500">{filtered.length} bill{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
            <PiArrowClockwise className="h-4 w-4" />
          </button>
          <Link href={routes.eCommerce.createVendorBill}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101]">
            <PiPlus className="h-4 w-4" /> New Bill
          </Link>
        </div>
      </div>
      <div className="mb-4 relative max-w-sm">
        <PiMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search bills…"
          className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20" />
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-gray-500">No bills found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Bill #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Vendor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Amount Due</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Due Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((bill) => (
                <tr key={bill._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{bill.billNumber}</td>
                  <td className="px-4 py-3 text-gray-700">{bill.vendorName ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[bill.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {statusLabel(bill.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{bill.currency} {bill.total?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">
                    {bill.amountDue > 0 ? `${bill.currency} ${bill.amountDue.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={routes.eCommerce.vendorBillDetails(bill._id)}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 inline-flex">
                      <PiEye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
