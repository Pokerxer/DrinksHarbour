'use client';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { taxService } from '@/services/tax.service';
import { fmtMoney } from './tax-helpers';

interface SummaryData {
  collected: number;
  paid: number;
  internal: number;
  netPayable: number;
  byTax: Array<{ taxName: string; taxRate: number; collected: number; paid: number }>;
}

const SELECT_CLS =
  'rounded border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400';

const CARD_STYLES = {
  netPayable: 'bg-gray-900 text-white',
  collected: 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200',
  paid: 'bg-blue-50 text-blue-800 ring-1 ring-blue-200',
  internal: 'bg-gray-50 text-gray-700 ring-1 ring-gray-200',
} as const;

export default function TaxSummary({ token }: { token: string }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await taxService.summary(token, { from: from || undefined, to: to || undefined });
      setData(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="date"
          className={SELECT_CLS}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          aria-label="From date"
        />
        <input
          type="date"
          className={SELECT_CLS}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          aria-label="To date"
        />
        <button
          type="button"
          onClick={load}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
        >
          Apply
        </button>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              setFrom('');
              setTo('');
            }}
            className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {loading && <p className="py-8 text-center text-gray-400">Loading…</p>}

      {!loading && data && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Net VAT Payable" value={fmtMoney(data.netPayable)} cls={CARD_STYLES.netPayable} />
            <StatCard label="Output (Collected)" value={fmtMoney(data.collected)} cls={CARD_STYLES.collected} />
            <StatCard label="Input (Paid)" value={fmtMoney(data.paid)} cls={CARD_STYLES.paid} />
            <StatCard label="Internal Transfers" value={fmtMoney(data.internal)} cls={CARD_STYLES.internal} />
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Tax</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3 text-right">Collected</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.byTax.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                      No posted records in this period.
                    </td>
                  </tr>
                )}
                {data.byTax.map((t) => (
                  <tr key={`${t.taxName}-${t.taxRate}`}>
                    <td className="px-4 py-3 font-medium">{t.taxName}</td>
                    <td className="px-4 py-3">{t.taxRate}%</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{fmtMoney(t.collected)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{fmtMoney(t.paid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className={`rounded-lg p-4 ${cls}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 whitespace-nowrap text-xl font-semibold">{value}</p>
    </div>
  );
}
