'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { PiArrowLeft, PiCheck, PiCurrencyDollar } from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { vendorBillService } from '@/services/vendorBill.service';
import type { VendorBill } from './types';
import { STATUS_BADGE, statusLabel } from './types';

export default function PurchasesBillDetail({ id }: { id: string }) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [bill, setBill] = useState<VendorBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [showPay, setShowPay] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await vendorBillService.getVendorBill(id, token);
      setBill(res.data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => { load(); }, [load]);

  async function handleValidate() {
    setActing(true);
    try {
      await vendorBillService.validateBill(id, token);
      toast.success('Bill posted');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to validate');
    } finally {
      setActing(false);
    }
  }

  async function handlePayment() {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { toast.error('Enter a valid amount'); return; }
    setActing(true);
    try {
      await vendorBillService.recordPayment(id, { amount, paymentDate: new Date().toISOString() }, token);
      toast.success('Payment recorded');
      setShowPay(false);
      setPayAmount('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setActing(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading…</div>;
  if (!bill) return <div className="py-20 text-center text-sm text-gray-500">Bill not found</div>;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <Link href={routes.eCommerce.vendorBills} className="flex items-center gap-1 hover:text-gray-700">
          <PiArrowLeft className="h-4 w-4" /> Vendor Bills
        </Link>
        <span>/</span>
        <span className="font-medium text-gray-900">{bill.billNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{bill.billNumber}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[bill.status] ?? 'bg-gray-100 text-gray-600'}`}>
              {statusLabel(bill.status)}
            </span>
          </div>
          {bill.vendorName && <p className="mt-1 text-sm text-gray-500">Vendor: {bill.vendorName}</p>}
        </div>
        <div className="flex gap-2">
          {bill.status === 'draft' && (
            <button type="button" onClick={handleValidate} disabled={acting}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50">
              <PiCheck className="h-4 w-4" /> Validate Bill
            </button>
          )}
          {bill.status === 'posted' && bill.amountDue > 0 && (
            <button type="button" onClick={() => setShowPay(true)}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
              <PiCurrencyDollar className="h-4 w-4" /> Record Payment
            </button>
          )}
        </div>
      </div>

      {showPay && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="mb-3 text-sm font-medium text-green-800">Record Payment — Amount Due: {bill.currency} {bill.amountDue.toFixed(2)}</p>
          <div className="flex items-center gap-3">
            <input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Amount paid"
              className="w-40 rounded-lg border border-green-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none" />
            <button type="button" onClick={handlePayment} disabled={acting}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
              {acting ? 'Saving…' : 'Confirm'}
            </button>
            <button type="button" onClick={() => setShowPay(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Bill Date', value: bill.billDate ? new Date(bill.billDate).toLocaleDateString() : '—' },
          { label: 'Due Date', value: bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—' },
          { label: 'Total', value: `${bill.currency} ${bill.total?.toFixed(2)}` },
          { label: 'Amount Due', value: bill.amountDue > 0 ? `${bill.currency} ${bill.amountDue.toFixed(2)}` : 'Paid' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-0.5 font-medium text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Bill Lines</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Product</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Unit Price</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Tax %</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {bill.items.map((item, i) => (
              <tr key={i}>
                <td className="px-4 py-3 font-medium text-gray-900">{item.productName}</td>
                <td className="px-4 py-3 text-right text-gray-700">{item.quantity}</td>
                <td className="px-4 py-3 text-right text-gray-700">{bill.currency} {item.unitPrice.toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{item.taxRate ?? 0}%</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{bill.currency} {item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 bg-gray-50">
              <td colSpan={4} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</td>
              <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{bill.currency} {bill.total?.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
