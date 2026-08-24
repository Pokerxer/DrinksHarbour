'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiPlus } from 'react-icons/pi';
import type { Tax } from '@/services/tax.service';
import TaxRatesTable from './tax-rates-table';
import TaxFormModal from './tax-form-modal';
import TaxLedgerTable from './tax-ledger-table';
import TaxSummary from './tax-summary';

type Tab = 'rates' | 'ledger' | 'summary';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'rates', label: 'Tax Rates' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'summary', label: 'Summary' },
];

// Tab shell for /accounting/taxes. `?tab=` keeps the sidebar's Ledger/Summary
// deep links working; switchTab mirrors it into the URL without a navigation.
export default function TaxesView() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as Tab) || 'rates';
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.key === initialTab) ? initialTab : 'rates'
  );
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Tax | null>(null);

  const switchTab = (next: Tab) => {
    setTab(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', next);
      window.history.replaceState(null, '', url.toString());
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm ring-1 ring-gray-200">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => switchTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                tab === t.key ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'rates' && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            <PiPlus size={16} /> New Tax
          </button>
        )}
      </div>

      {tab === 'rates' && (
        <TaxRatesTable
          token={token}
          onEdit={(tax) => {
            setEditing(tax);
            setShowForm(true);
          }}
        />
      )}
      {tab === 'ledger' && <TaxLedgerTable token={token} />}
      {tab === 'summary' && <TaxSummary token={token} />}

      {showForm && (
        <TaxFormModal token={token} editing={editing} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}
