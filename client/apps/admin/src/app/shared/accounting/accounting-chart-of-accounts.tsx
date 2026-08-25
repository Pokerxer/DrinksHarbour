'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { PiPlus } from 'react-icons/pi';
import { accountingService, type Account } from '@/services/accounting.service';
import AccountingNavHeader from './accounting-nav-header';
import CoaTable from './coa-table';
import CoaFormModal from './coa-form-modal';

/** /accounting/chart-of-accounts — grouped COA table + create/edit modal. */
export default function AccountingChartOfAccounts() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await accountingService.accounts(token);
      setAccounts(res.data ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleActive = async (a: Account) => {
    try {
      await accountingService.updateAccount(token, a._id, { isActive: !a.isActive });
      toast.success(a.isActive ? `${a.name} deactivated` : `${a.name} activated`);
      await load();
    } catch (e) {
      // 409 = referenced by journal lines — surface the server's guidance.
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AccountingNavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">Chart of Accounts</h1>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            <PiPlus size={16} /> New Account
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-gray-400">Loading accounts…</p>
        ) : (
          <CoaTable
            accounts={accounts}
            onEdit={(a) => {
              setEditing(a);
              setShowForm(true);
            }}
            onToggleActive={toggleActive}
          />
        )}

        {showForm && (
          <CoaFormModal
            editing={editing}
            onClose={() => setShowForm(false)}
            onSaved={() => load()}
          />
        )}
      </main>
    </div>
  );
}
