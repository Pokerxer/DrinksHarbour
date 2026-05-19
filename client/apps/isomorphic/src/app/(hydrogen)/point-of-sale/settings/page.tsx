'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { routes } from '@/config/routes';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import {
  PiPlus, PiTrash, PiFloppyDisk, PiBank, PiArrowLeft,
  PiStorefront, PiWarning, PiCheckCircle,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

type BankAccount = { bankName: string; accountNumber: string; accountName: string };

// ── Toggle component ──────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none
        ${checked ? 'bg-[#b20202]' : 'bg-gray-200'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200
          ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

// ── Settings card ─────────────────────────────────────────────────────────────
function SettingsCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#b20202]/10">
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ── Setting row ───────────────────────────────────────────────────────────────
function SettingRow({
  label,
  description,
  warning,
  children,
}: {
  label: string;
  description: string;
  warning?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-50 last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        {warning && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <PiWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {warning}
          </div>
        )}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function POSSettingsPage() {
  const router = useRouter();
  const { token } = usePOSAuth();

  // Bank accounts state
  const [accounts,       setAccounts]       = useState<BankAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [savingAccounts,  setSavingAccounts]  = useState(false);

  // POS settings state
  const [allowOverselling,  setAllowOverselling]  = useState(false);
  const [loadingSettings,   setLoadingSettings]   = useState(true);
  const [savingSettings,    setSavingSettings]    = useState(false);

  useEffect(() => {
    if (!token) return;

    posApi.getBankAccounts(token)
      .then((d) => setAccounts((d.bankAccounts ?? []).map((b) => ({
        bankName:      b.bankName      || '',
        accountNumber: b.accountNumber || '',
        accountName:   b.accountName   || '',
      }))))
      .catch(() => {})
      .finally(() => setLoadingAccounts(false));

    posApi.getPOSSettings(token)
      .then((d) => {
        setAllowOverselling(d.posSettings?.allowOverselling ?? false);
      })
      .catch(() => {})
      .finally(() => setLoadingSettings(false));
  }, [token]);

  // Bank accounts handlers
  function addRow() { setAccounts((p) => [...p, { bankName: '', accountNumber: '', accountName: '' }]); }
  function removeRow(i: number) { setAccounts((p) => p.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: keyof BankAccount, value: string) {
    setAccounts((p) => p.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
  }

  async function handleSaveAccounts() {
    if (!token) return;
    setSavingAccounts(true);
    try {
      await posApi.updateBankAccounts(token, accounts);
      toast.success('Bank accounts saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSavingAccounts(false);
    }
  }

  // POS settings handler — saves immediately on toggle
  async function handleToggleOverselling(value: boolean) {
    if (!token) return;
    setAllowOverselling(value);
    setSavingSettings(true);
    try {
      await posApi.updatePOSSettings(token, { allowOverselling: value });
      toast.success(value ? 'Overselling enabled' : 'Overselling disabled');
    } catch (err: any) {
      setAllowOverselling(!value); // revert on error
      toast.error(err.message || 'Failed to save setting');
    } finally {
      setSavingSettings(false);
    }
  }

  const loading = loadingAccounts || loadingSettings;

  return (
    <div className="min-h-screen bg-gray-50">
      <POSNavHeader />

      <div className="mx-auto max-w-3xl px-4 py-10 space-y-6">

        {/* Page header */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.push(routes.pos.index)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <PiArrowLeft className="h-4 w-4" /> Back
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">POS Settings</h1>
            <p className="text-sm text-gray-500">Manage how your point of sale behaves</p>
          </div>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-[#b20202]" />
          </div>
        ) : (
          <>
            {/* ── Sales settings ── */}
            <SettingsCard
              icon={<PiStorefront className="h-5 w-5 text-[#b20202]" />}
              title="Sales"
              description="Control how products are sold at the terminal"
            >
              <SettingRow
                label="Continue selling when out of stock"
                description="When enabled, cashiers can add products to the cart and complete orders even if the product's available stock is zero or negative. Stock levels will go below zero."
                warning={
                  allowOverselling
                    ? "Overselling is ON — orders will be accepted even if stock runs out. Monitor your inventory closely."
                    : undefined
                }
              >
                <div className="flex items-center gap-2">
                  {savingSettings && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-500" />
                  )}
                  <Toggle
                    checked={allowOverselling}
                    onChange={handleToggleOverselling}
                    disabled={savingSettings}
                  />
                </div>
              </SettingRow>

              {/* Status indicator */}
              <div className={`mx-6 mb-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold
                ${allowOverselling ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                {allowOverselling
                  ? <PiWarning className="h-4 w-4 shrink-0" />
                  : <PiCheckCircle className="h-4 w-4 shrink-0" />}
                {allowOverselling
                  ? 'Products will be sold even when stock reaches zero'
                  : 'Sales are blocked for out-of-stock products'}
              </div>
            </SettingsCard>

            {/* ── Bank accounts ── */}
            <SettingsCard
              icon={<PiBank className="h-5 w-5 text-[#b20202]" />}
              title="Bank Accounts"
              description="Appear in the top-right of every printed invoice"
            >
              <div className="divide-y divide-gray-50 px-6">
                {accounts.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="mb-3 text-sm text-gray-400">No bank accounts added yet</p>
                    <button
                      type="button"
                      onClick={addRow}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700"
                    >
                      <PiPlus className="h-4 w-4" /> Add account
                    </button>
                  </div>
                ) : (
                  accounts.map((row, i) => (
                    <div key={i} className="py-4">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Account {i + 1}</span>
                        <button type="button" onClick={() => removeRow(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                          <PiTrash className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          { field: 'bankName' as const, label: 'Bank Name', placeholder: 'e.g. Zenith Bank', mono: false },
                          { field: 'accountNumber' as const, label: 'Account Number', placeholder: 'e.g. 1016038076', mono: true },
                          { field: 'accountName' as const, label: 'Account Name', placeholder: 'e.g. Cloud Bay Ventures', mono: false },
                        ]).map(({ field, label, placeholder, mono }) => (
                          <div key={field}>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                              {label}
                            </label>
                            <input
                              type="text"
                              value={row[field]}
                              onChange={(e) => updateRow(i, field, e.target.value)}
                              placeholder={placeholder}
                              className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20 ${mono ? 'font-mono' : ''}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={addRow}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-[#b20202] hover:text-[#b20202]"
                >
                  <PiPlus className="h-4 w-4" /> Add account
                </button>
                <button
                  type="button"
                  onClick={handleSaveAccounts}
                  disabled={savingAccounts}
                  className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: '#b20202' }}
                >
                  <PiFloppyDisk className="h-4 w-4" />
                  {savingAccounts ? 'Saving…' : 'Save Accounts'}
                </button>
              </div>
            </SettingsCard>
          </>
        )}
      </div>
    </div>
  );
}
