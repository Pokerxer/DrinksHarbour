'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { routes } from '@/config/routes';
import POSNavHeader from '@/app/shared/point-of-sale/pos-nav-header';
import {
  PiPlus,
  PiTrash,
  PiFloppyDisk,
  PiBank,
  PiArrowLeft,
  PiStorefront,
  PiWarning,
  PiCheckCircle,
  PiStar,
  PiReceipt,
  PiPercent,
  PiCurrencyNgn,
  PiCreditCard,
  PiClock,
  PiCheck,
} from 'react-icons/pi';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type SalesState = { allowOverselling: boolean; maxDiscountPct: number };
type SessionState = { requireOpeningCash: boolean };
type LoyaltyState = {
  enabled: boolean;
  pointsPerNaira: number;
  pointsValue: number;
  maxRedemption: number;
};
type ReceiptState = {
  header: string;
  footer: string;
  showTax: boolean;
  taxRate: number;
  autoPrint: boolean;
  copies: number;
};
type BankAccount = {
  bankName: string;
  accountNumber: string;
  accountName: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', sub: 'Physical cash payments' },
  { id: 'card', label: 'Card / POS', sub: 'Debit & credit card payments' },
  {
    id: 'bank_transfer',
    label: 'Bank Transfer',
    sub: 'Direct bank transfers & USSD',
  },
  {
    id: 'mobile_money',
    label: 'Mobile Money',
    sub: 'Opay, Palmpay, Kuda, etc.',
  },
];

const D_SALES: SalesState = { allowOverselling: false, maxDiscountPct: 100 };
const D_SESSION: SessionState = { requireOpeningCash: false };
const D_LOYALTY: LoyaltyState = {
  enabled: false,
  pointsPerNaira: 0.01,
  pointsValue: 1,
  maxRedemption: 50,
};
const D_RECEIPT: ReceiptState = {
  header: '',
  footer: '',
  showTax: false,
  taxRate: 7.5,
  autoPrint: false,
  copies: 1,
};
const D_METHODS = ['cash', 'card', 'bank_transfer', 'mobile_money'];

function objDirty<T>(a: T, b: T) {
  return JSON.stringify(a) !== JSON.stringify(b);
}
function arrDirty(a: string[], b: string[]) {
  return JSON.stringify([...a].sort()) !== JSON.stringify([...b].sort());
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />
  );
}
function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <Sk className="h-9 w-9 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Sk className="h-4 w-28" />
          <Sk className="h-3 w-44" />
        </div>
      </div>
      <div className="space-y-3 px-6 py-5">
        <Sk className="h-12 w-full" />
        <Sk className="h-12 w-2/3" />
      </div>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
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
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-[#b20202]' : 'bg-gray-200'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function Card({
  icon,
  title,
  description,
  dirty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  dirty?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white shadow-sm transition-colors ${dirty ? 'border-amber-200' : 'border-gray-200'}`}
    >
      <div className="flex items-center gap-3 border-b border-inherit px-6 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b20202]/10">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-400">{description}</p>
        </div>
        {dirty && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unsaved
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────
function Row({
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
    <div className="flex items-start justify-between gap-4 border-b border-gray-50 px-6 py-5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        {warning && (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <PiWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
          </div>
        )}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

// ── Field (label + input + error) ─────────────────────────────────────────────
function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] font-medium text-red-500">{error}</p>
      )}
      {!error && hint && (
        <p className="mt-1 text-[11px] text-gray-400">{hint}</p>
      )}
    </div>
  );
}

// ── Num input ─────────────────────────────────────────────────────────────────
function NumInput({
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  hasError,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: React.ReactNode;
  suffix?: string;
  hasError?: boolean;
}) {
  return (
    <div
      className={`flex items-center rounded-lg border transition-colors focus-within:ring-1 ${
        hasError
          ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-200'
          : 'border-gray-200 focus-within:border-[#b20202] focus-within:ring-[#b20202]/20'
      }`}
    >
      {prefix && (
        <span className="flex items-center pl-3 text-gray-400">{prefix}</span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg bg-transparent px-3 py-2 text-sm outline-none"
      />
      {suffix && <span className="pr-3 text-xs text-gray-400">{suffix}</span>}
    </div>
  );
}

// ── Section footer ────────────────────────────────────────────────────────────
function Footer({
  dirty,
  saving,
  onSave,
  onDiscard,
  label,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  label: string;
}) {
  if (!dirty && !saving) return null;
  return (
    <div className="flex items-center justify-between rounded-b-2xl border-t border-amber-100 bg-amber-50/50 px-6 py-3.5">
      <button
        type="button"
        onClick={onDiscard}
        disabled={saving}
        className="text-sm text-gray-500 underline-offset-2 hover:text-gray-700 hover:underline disabled:opacity-40"
      >
        Discard changes
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: '#b20202' }}
      >
        {saving ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        ) : (
          <PiFloppyDisk className="h-4 w-4" />
        )}
        {saving ? 'Saving…' : `Save ${label}`}
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function POSSettingsPage() {
  const router = useRouter();
  const { token } = usePOSAuth();
  const [loading, setLoading] = useState(true);

  // ── Section states (current + saved for dirty/discard) ────────────────────
  const [sales, setSales] = useState<SalesState>(D_SALES);
  const [savedSales, setSavedSales] = useState<SalesState>(D_SALES);
  const [savingSales, setSavingSales] = useState(false);
  const salesDirty = objDirty(sales, savedSales);

  const [session, setSession] = useState<SessionState>(D_SESSION);
  const [savedSession, setSavedSession] = useState<SessionState>(D_SESSION);
  const [savingSession, setSavingSession] = useState(false);
  const sessionDirty = objDirty(session, savedSession);

  const [methods, setMethods] = useState<string[]>(D_METHODS);
  const [savedMethods, setSavedMethods] = useState<string[]>(D_METHODS);
  const [savingMethods, setSavingMethods] = useState(false);
  const methodsDirty = arrDirty(methods, savedMethods);

  const [loyalty, setLoyalty] = useState<LoyaltyState>(D_LOYALTY);
  const [savedLoyalty, setSavedLoyalty] = useState<LoyaltyState>(D_LOYALTY);
  const [savingLoyalty, setSavingLoyalty] = useState(false);
  const loyaltyDirty = objDirty(loyalty, savedLoyalty);

  const [receipt, setReceipt] = useState<ReceiptState>(D_RECEIPT);
  const [savedReceipt, setSavedReceipt] = useState<ReceiptState>(D_RECEIPT);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const receiptDirty = objDirty(receipt, savedReceipt);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [savedAccounts, setSavedAccounts] = useState<BankAccount[]>([]);
  const [savingAccounts, setSavingAccounts] = useState(false);
  const accountsDirty =
    JSON.stringify(accounts) !== JSON.stringify(savedAccounts);

  // ── Validation errors ─────────────────────────────────────────────────────
  const [salesErr, setSalesErr] = useState<Record<string, string>>({});
  const [loyaltyErr, setLoyaltyErr] = useState<Record<string, string>>({});
  const [receiptErr, setReceiptErr] = useState<Record<string, string>>({});

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    Promise.all([posApi.getBankAccounts(token), posApi.getPOSSettings(token)])
      .then(([bankData, settingsData]) => {
        const accts = (bankData.bankAccounts ?? []).map((b) => ({
          bankName: b.bankName || '',
          accountNumber: b.accountNumber || '',
          accountName: b.accountName || '',
        }));
        setAccounts(accts);
        setSavedAccounts(accts);

        const s = settingsData.posSettings ?? {};

        const ns: SalesState = {
          allowOverselling: s.allowOverselling ?? false,
          maxDiscountPct: s.maxDiscountPct ?? 100,
        };
        setSales(ns);
        setSavedSales(ns);

        const ns2: SessionState = {
          requireOpeningCash: s.requireOpeningCash ?? false,
        };
        setSession(ns2);
        setSavedSession(ns2);

        const nm = s.enabledPaymentMethods?.length
          ? [...s.enabledPaymentMethods]
          : [...D_METHODS];
        setMethods(nm);
        setSavedMethods(nm);

        const nl: LoyaltyState = {
          enabled: s.loyaltyEnabled ?? false,
          pointsPerNaira: s.loyaltyPointsPerNaira ?? 0.01,
          pointsValue: s.loyaltyPointsValue ?? 1,
          maxRedemption: s.loyaltyMaxRedemptionPct ?? 50,
        };
        setLoyalty(nl);
        setSavedLoyalty(nl);

        const nr: ReceiptState = {
          header: s.receiptHeader ?? '',
          footer: s.receiptFooter ?? '',
          showTax: s.showTaxOnReceipt ?? false,
          taxRate: s.taxRate ?? 7.5,
          autoPrint: s.autoPrintReceipt ?? false,
          copies: s.receiptCopies ?? 1,
        };
        setReceipt(nr);
        setSavedReceipt(nr);
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, [token]);

  // ── Save handlers ─────────────────────────────────────────────────────────
  async function saveSales() {
    if (!token) return;
    const err: Record<string, string> = {};
    if (sales.maxDiscountPct < 0 || sales.maxDiscountPct > 100)
      err.maxDiscountPct = 'Must be 0–100';
    setSalesErr(err);
    if (Object.keys(err).length) return;
    setSavingSales(true);
    try {
      await posApi.updatePOSSettings(token, {
        allowOverselling: sales.allowOverselling,
        maxDiscountPct: sales.maxDiscountPct,
      });
      setSavedSales({ ...sales });
      toast.success('Sales settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingSales(false);
    }
  }

  async function saveSession() {
    if (!token) return;
    setSavingSession(true);
    try {
      await posApi.updatePOSSettings(token, {
        requireOpeningCash: session.requireOpeningCash,
      });
      setSavedSession({ ...session });
      toast.success('Session settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingSession(false);
    }
  }

  async function saveMethods() {
    if (!token) return;
    if (methods.length === 0) {
      toast.error('At least one payment method must be enabled');
      return;
    }
    setSavingMethods(true);
    try {
      await posApi.updatePOSSettings(token, { enabledPaymentMethods: methods });
      setSavedMethods([...methods]);
      toast.success('Payment methods saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingMethods(false);
    }
  }

  async function saveLoyalty() {
    if (!token) return;
    const err: Record<string, string> = {};
    if (loyalty.enabled) {
      if (loyalty.pointsPerNaira <= 0) err.pointsPerNaira = 'Must be > 0';
      if (loyalty.pointsValue <= 0) err.pointsValue = 'Must be > 0';
      if (loyalty.maxRedemption < 0 || loyalty.maxRedemption > 100)
        err.maxRedemption = 'Must be 0–100';
    }
    setLoyaltyErr(err);
    if (Object.keys(err).length) return;
    setSavingLoyalty(true);
    try {
      await posApi.updatePOSSettings(token, {
        loyaltyEnabled: loyalty.enabled,
        loyaltyPointsPerNaira: loyalty.pointsPerNaira,
        loyaltyPointsValue: loyalty.pointsValue,
        loyaltyMaxRedemptionPct: loyalty.maxRedemption,
      });
      setSavedLoyalty({ ...loyalty });
      toast.success('Loyalty settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingLoyalty(false);
    }
  }

  async function saveReceipt() {
    if (!token) return;
    const err: Record<string, string> = {};
    if (receipt.showTax && (receipt.taxRate < 0 || receipt.taxRate > 100))
      err.taxRate = 'Must be 0–100';
    if (receipt.copies < 1 || receipt.copies > 5) err.copies = 'Must be 1–5';
    setReceiptErr(err);
    if (Object.keys(err).length) return;
    setSavingReceipt(true);
    try {
      await posApi.updatePOSSettings(token, {
        receiptHeader: receipt.header,
        receiptFooter: receipt.footer,
        showTaxOnReceipt: receipt.showTax,
        taxRate: receipt.taxRate,
        autoPrintReceipt: receipt.autoPrint,
        receiptCopies: receipt.copies,
      });
      setSavedReceipt({ ...receipt });
      toast.success('Receipt settings saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingReceipt(false);
    }
  }

  async function saveAccounts() {
    if (!token) return;
    setSavingAccounts(true);
    try {
      await posApi.updateBankAccounts(token, accounts);
      setSavedAccounts(accounts.map((a) => ({ ...a })));
      toast.success('Bank accounts saved');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save');
    } finally {
      setSavingAccounts(false);
    }
  }

  function toggleMethod(id: string) {
    setMethods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <POSNavHeader />

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
        {/* Header */}
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
            <p className="text-sm text-gray-500">
              Manage how your point of sale behaves
            </p>
          </div>
        </div>

        {loading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : (
          <>
            {/* ── Sales ─────────────────────────────────────────────────────── */}
            <Card
              icon={<PiStorefront className="h-5 w-5 text-[#b20202]" />}
              title="Sales"
              description="How products are sold and discounts applied"
              dirty={salesDirty}
            >
              <Row
                label="Continue selling when out of stock"
                description="Cashiers can add out-of-stock products and complete orders. Stock will go negative."
                warning={
                  sales.allowOverselling
                    ? 'Overselling is ON — orders proceed even when stock is zero.'
                    : undefined
                }
              >
                <Toggle
                  checked={sales.allowOverselling}
                  onChange={(v) =>
                    setSales((p) => ({ ...p, allowOverselling: v }))
                  }
                />
              </Row>

              <div className="px-6 py-5">
                <Field
                  label="Maximum cashier discount %"
                  error={salesErr.maxDiscountPct}
                  hint={
                    sales.maxDiscountPct >= 100
                      ? 'Cashiers can apply any discount amount.'
                      : `Cashiers cannot discount more than ${sales.maxDiscountPct}% per order.`
                  }
                >
                  <NumInput
                    value={sales.maxDiscountPct}
                    onChange={(v) =>
                      setSales((p) => ({ ...p, maxDiscountPct: v }))
                    }
                    min={0}
                    max={100}
                    step={1}
                    prefix={<PiPercent className="h-3.5 w-3.5" />}
                    suffix="%"
                    hasError={!!salesErr.maxDiscountPct}
                  />
                </Field>
              </div>

              <Footer
                dirty={salesDirty}
                saving={savingSales}
                onSave={saveSales}
                onDiscard={() => {
                  setSales({ ...savedSales });
                  setSalesErr({});
                }}
                label="Sales"
              />
            </Card>

            {/* ── Sessions ──────────────────────────────────────────────────── */}
            <Card
              icon={<PiClock className="h-5 w-5 text-[#b20202]" />}
              title="Sessions"
              description="Control how cashiers open and close POS sessions"
              dirty={sessionDirty}
            >
              <Row
                label="Require opening cash amount"
                description="Force cashiers to enter the amount of cash in the drawer before they can start a session."
              >
                <Toggle
                  checked={session.requireOpeningCash}
                  onChange={(v) => setSession({ requireOpeningCash: v })}
                />
              </Row>

              <Footer
                dirty={sessionDirty}
                saving={savingSession}
                onSave={saveSession}
                onDiscard={() => setSession({ ...savedSession })}
                label="Sessions"
              />
            </Card>

            {/* ── Payment Methods ───────────────────────────────────────────── */}
            <Card
              icon={<PiCreditCard className="h-5 w-5 text-[#b20202]" />}
              title="Payment Methods"
              description="Choose which methods are available at checkout"
              dirty={methodsDirty}
            >
              <div className="grid grid-cols-2 gap-3 px-6 py-5">
                {PAYMENT_METHODS.map((m) => {
                  const active = methods.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMethod(m.id)}
                      className={`flex items-center justify-between rounded-xl border-2 px-4 py-3.5 text-left transition-all ${active ? 'border-[#b20202] bg-[#b20202]/5' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-sm font-semibold ${active ? 'text-[#b20202]' : 'text-gray-800'}`}
                        >
                          {m.label}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-gray-400">
                          {m.sub}
                        </p>
                      </div>
                      <div
                        className={`ml-3 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${active ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300 bg-white'}`}
                      >
                        {active && <PiCheck className="h-3 w-3 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {methods.length === 0 && (
                <div className="mx-6 mb-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                  <PiWarning className="h-4 w-4 shrink-0" />
                  At least one payment method must be enabled.
                </div>
              )}

              <Footer
                dirty={methodsDirty}
                saving={savingMethods}
                onSave={saveMethods}
                onDiscard={() => setMethods([...savedMethods])}
                label="Payment Methods"
              />
            </Card>

            {/* ── Loyalty ───────────────────────────────────────────────────── */}
            <Card
              icon={<PiStar className="h-5 w-5 text-[#b20202]" />}
              title="Loyalty Programme"
              description="Reward customers with points on every purchase"
              dirty={loyaltyDirty}
            >
              <Row
                label="Enable loyalty programme"
                description="Customers earn points on completed orders and can redeem them as a discount."
              >
                <Toggle
                  checked={loyalty.enabled}
                  onChange={(v) => setLoyalty((p) => ({ ...p, enabled: v }))}
                />
              </Row>

              <div
                className={`px-6 pb-6 pt-4 transition-opacity ${!loyalty.enabled ? 'pointer-events-none opacity-40' : ''}`}
              >
                <div className="grid grid-cols-3 gap-4">
                  <Field
                    label="Points per ₦1 spent"
                    error={loyaltyErr.pointsPerNaira}
                  >
                    <NumInput
                      value={loyalty.pointsPerNaira}
                      onChange={(v) =>
                        setLoyalty((p) => ({ ...p, pointsPerNaira: v }))
                      }
                      min={0.001}
                      step={0.001}
                      prefix={<PiCurrencyNgn className="h-3.5 w-3.5" />}
                      suffix="pts"
                      hasError={!!loyaltyErr.pointsPerNaira}
                    />
                  </Field>
                  <Field label="1 point = ₦" error={loyaltyErr.pointsValue}>
                    <NumInput
                      value={loyalty.pointsValue}
                      onChange={(v) =>
                        setLoyalty((p) => ({ ...p, pointsValue: v }))
                      }
                      min={0.01}
                      step={0.01}
                      prefix={<PiCurrencyNgn className="h-3.5 w-3.5" />}
                      hasError={!!loyaltyErr.pointsValue}
                    />
                  </Field>
                  <Field
                    label="Max bill paid with points"
                    error={loyaltyErr.maxRedemption}
                  >
                    <NumInput
                      value={loyalty.maxRedemption}
                      onChange={(v) =>
                        setLoyalty((p) => ({ ...p, maxRedemption: v }))
                      }
                      min={0}
                      max={100}
                      step={1}
                      prefix={<PiPercent className="h-3.5 w-3.5" />}
                      suffix="%"
                      hasError={!!loyaltyErr.maxRedemption}
                    />
                  </Field>
                </div>

                {loyalty.enabled && (
                  <div className="mt-3 rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-500">
                    Example: ₦1,000 order earns{' '}
                    <span className="font-semibold text-gray-700">
                      {(loyalty.pointsPerNaira * 1000).toFixed(0)} pts
                    </span>{' '}
                    worth{' '}
                    <span className="font-semibold text-gray-700">
                      ₦
                      {(
                        loyalty.pointsPerNaira *
                        1000 *
                        loyalty.pointsValue
                      ).toFixed(2)}
                    </span>
                    . Max redeemable:{' '}
                    <span className="font-semibold text-gray-700">
                      ₦{((loyalty.maxRedemption / 100) * 1000).toFixed(0)}
                    </span>{' '}
                    ({loyalty.maxRedemption}% of bill).
                  </div>
                )}
              </div>

              <Footer
                dirty={loyaltyDirty}
                saving={savingLoyalty}
                onSave={saveLoyalty}
                onDiscard={() => {
                  setLoyalty({ ...savedLoyalty });
                  setLoyaltyErr({});
                }}
                label="Loyalty"
              />
            </Card>

            {/* ── Receipt ───────────────────────────────────────────────────── */}
            <Card
              icon={<PiReceipt className="h-5 w-5 text-[#b20202]" />}
              title="Receipt"
              description="Customise printed receipts and print behaviour"
              dirty={receiptDirty}
            >
              <Row
                label="Auto-print receipt after sale"
                description="Automatically send the receipt to the printer once a transaction is completed."
              >
                <Toggle
                  checked={receipt.autoPrint}
                  onChange={(v) => setReceipt((p) => ({ ...p, autoPrint: v }))}
                />
              </Row>

              <div className="border-b border-gray-50 px-6 py-5">
                <Field
                  label="Number of copies"
                  error={receiptErr.copies}
                  hint="How many receipt copies to print per transaction (1–5)."
                >
                  <NumInput
                    value={receipt.copies}
                    onChange={(v) => setReceipt((p) => ({ ...p, copies: v }))}
                    min={1}
                    max={5}
                    step={1}
                    suffix="copies"
                    hasError={!!receiptErr.copies}
                  />
                </Field>
              </div>

              <Row
                label="Show tax breakdown on receipt"
                description="Print a line showing the VAT / tax amount included in the order total."
              >
                <Toggle
                  checked={receipt.showTax}
                  onChange={(v) => setReceipt((p) => ({ ...p, showTax: v }))}
                />
              </Row>

              {receipt.showTax && (
                <div className="border-b border-gray-50 px-6 py-5">
                  <Field
                    label="VAT / Tax rate"
                    error={receiptErr.taxRate}
                    hint="Standard Nigerian VAT is 7.5%."
                  >
                    <NumInput
                      value={receipt.taxRate}
                      onChange={(v) =>
                        setReceipt((p) => ({ ...p, taxRate: v }))
                      }
                      min={0}
                      max={100}
                      step={0.1}
                      prefix={<PiPercent className="h-3.5 w-3.5" />}
                      suffix="%"
                      hasError={!!receiptErr.taxRate}
                    />
                  </Field>
                </div>
              )}

              <div className="space-y-4 px-6 py-5">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Header text
                  </label>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={receipt.header}
                    onChange={(e) =>
                      setReceipt((p) => ({ ...p, header: e.target.value }))
                    }
                    placeholder="e.g. Thank you for shopping with us!"
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20"
                  />
                  <p className="mt-1 text-right text-[11px] text-gray-300">
                    {receipt.header.length}/200
                  </p>
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Footer text
                  </label>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={receipt.footer}
                    onChange={(e) =>
                      setReceipt((p) => ({ ...p, footer: e.target.value }))
                    }
                    placeholder="e.g. Goods sold are not returnable. Thank you!"
                    className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20"
                  />
                  <p className="mt-1 text-right text-[11px] text-gray-300">
                    {receipt.footer.length}/200
                  </p>
                </div>
              </div>

              <Footer
                dirty={receiptDirty}
                saving={savingReceipt}
                onSave={saveReceipt}
                onDiscard={() => {
                  setReceipt({ ...savedReceipt });
                  setReceiptErr({});
                }}
                label="Receipt"
              />
            </Card>

            {/* ── Bank Accounts ─────────────────────────────────────────────── */}
            <Card
              icon={<PiBank className="h-5 w-5 text-[#b20202]" />}
              title="Bank Accounts"
              description="Appear in the top-right of every printed invoice"
              dirty={accountsDirty}
            >
              <div className="divide-y divide-gray-50 px-6">
                {accounts.length === 0 && (
                  <p className="py-6 text-center text-sm text-gray-400">
                    No bank accounts added yet
                  </p>
                )}
                {accounts.map((row, i) => (
                  <div key={i} className="py-4">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Account {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setAccounts((p) => p.filter((_, idx) => idx !== i))
                        }
                        className="text-gray-300 transition-colors hover:text-red-500"
                      >
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {
                          field: 'bankName' as const,
                          label: 'Bank Name',
                          placeholder: 'e.g. Zenith Bank',
                          mono: false,
                        },
                        {
                          field: 'accountNumber' as const,
                          label: 'Account Number',
                          placeholder: 'e.g. 1016038076',
                          mono: true,
                        },
                        {
                          field: 'accountName' as const,
                          label: 'Account Name',
                          placeholder: 'e.g. Cloud Bay Ventures',
                          mono: false,
                        },
                      ].map(({ field, label, placeholder, mono }) => (
                        <div key={field}>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            {label}
                          </label>
                          <input
                            type="text"
                            value={row[field]}
                            placeholder={placeholder}
                            onChange={(e) =>
                              setAccounts((p) =>
                                p.map((r, idx) =>
                                  idx === i
                                    ? { ...r, [field]: e.target.value }
                                    : r
                                )
                              )
                            }
                            className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#b20202] focus:ring-1 focus:ring-[#b20202]/20 ${mono ? 'font-mono' : ''}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-50 px-6 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setAccounts((p) => [
                      ...p,
                      { bankName: '', accountNumber: '', accountName: '' },
                    ])
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-500 hover:border-[#b20202] hover:text-[#b20202]"
                >
                  <PiPlus className="h-4 w-4" /> Add account
                </button>
              </div>

              <Footer
                dirty={accountsDirty}
                saving={savingAccounts}
                onSave={saveAccounts}
                onDiscard={() =>
                  setAccounts(savedAccounts.map((a) => ({ ...a })))
                }
                label="Accounts"
              />
            </Card>

            {/* ── Status summary ────────────────────────────────────────────── */}
            {[
              salesDirty,
              sessionDirty,
              methodsDirty,
              loyaltyDirty,
              receiptDirty,
              accountsDirty,
            ].some(Boolean) ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                <PiWarning className="h-4 w-4 shrink-0" />
                You have unsaved changes in one or more sections above.
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                <PiCheckCircle className="h-4 w-4 shrink-0" />
                All settings are saved.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
