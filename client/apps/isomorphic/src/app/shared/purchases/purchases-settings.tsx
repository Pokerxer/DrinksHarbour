'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { PiFloppyDisk, PiArrowsClockwise } from 'react-icons/pi';
import toast from 'react-hot-toast';
import {
  purchaseOrderService,
  type PurchaseSettings,
} from '@/services/purchaseOrder.service';
import { fraunces } from './purchases-fonts';

const CURRENCIES: PurchaseSettings['defaultCurrency'][] = [
  'NGN',
  'USD',
  'EUR',
  'GBP',
];

export default function PurchasesSettings() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [settings, setSettings] = useState<PurchaseSettings | null>(null);
  const [baseline, setBaseline] = useState<PurchaseSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await purchaseOrderService.getSettings(token);
      setSettings(res.data.purchaseSettings);
      setBaseline(res.data.purchaseSettings);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to load settings'
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(baseline),
    [settings, baseline]
  );

  function patch(p: Partial<PurchaseSettings>) {
    setSettings((prev) => (prev ? { ...prev, ...p } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await purchaseOrderService.updateSettings(settings, token);
      if (res.success) {
        setSettings(res.data.purchaseSettings);
        setBaseline(res.data.purchaseSettings);
        toast.success('Settings saved');
      } else {
        toast.error(res.message || 'Save failed');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <div className="h-20 animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
        <div className="h-64 animate-pulse rounded-2xl border border-[#ece4d6] bg-white" />
      </div>
    );
  }

  const card = 'rounded-2xl border border-[#ece4d6] bg-white p-5 shadow-sm';
  const label = 'mb-1 block text-xs font-medium text-gray-600';
  const input =
    'w-full rounded-lg border border-[#ece4d6] px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/15';

  const Toggle = ({
    checked,
    onChange,
    title,
    desc,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    title: string;
    desc: string;
  }) => (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-gray-800">{title}</span>
        <span className="block text-xs text-gray-500">{desc}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <span
          className={`block h-5 w-9 rounded-full transition-colors ${checked ? 'bg-[#b20202]' : 'bg-gray-200'}`}
        />
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
        />
      </span>
    </label>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
            Configuration
          </p>
          <h1
            className={`${fraunces.className} mt-1 text-[26px] font-semibold text-[#2a2420]`}
          >
            Purchase Settings
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-[#FAF8F3]"
          >
            <PiArrowsClockwise className="h-3.5 w-3.5" /> Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !dirty}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiFloppyDisk className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Order Policy */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Order Policy
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Default Currency</label>
              <select
                className={input}
                value={settings.defaultCurrency}
                onChange={(e) =>
                  patch({
                    defaultCurrency: e.target
                      .value as PurchaseSettings['defaultCurrency'],
                  })
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Default Bill Control</label>
              <select
                className={input}
                value={settings.defaultBillControlPolicy}
                onChange={(e) =>
                  patch({
                    defaultBillControlPolicy: e.target
                      .value as PurchaseSettings['defaultBillControlPolicy'],
                  })
                }
              >
                <option value="received">On received quantities</option>
                <option value="ordered">On ordered quantities</option>
              </select>
            </div>
            <div>
              <label className={label}>Default Payment Terms</label>
              <input
                className={input}
                value={settings.defaultPaymentTerms}
                onChange={(e) => patch({ defaultPaymentTerms: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>Default Lead Time (days)</label>
              <input
                type="number"
                min={0}
                max={365}
                className={input}
                value={settings.defaultLeadTimeDays}
                onChange={(e) =>
                  patch({ defaultLeadTimeDays: Number(e.target.value) })
                }
              />
            </div>
          </div>
        </div>

        {/* Approval */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Approval</h2>
          <div className="space-y-4">
            <Toggle
              checked={settings.requirePOApproval}
              onChange={(v) => patch({ requirePOApproval: v })}
              title="Require approval for purchase orders"
              desc="POs must be approved before they can be confirmed."
            />
            <div>
              <label className={label}>Approval Threshold (0 = all POs)</label>
              <input
                type="number"
                min={0}
                disabled={!settings.requirePOApproval}
                className={`${input} disabled:bg-gray-50 disabled:text-gray-400`}
                value={settings.approvalThreshold}
                onChange={(e) =>
                  patch({ approvalThreshold: Number(e.target.value) })
                }
              />
              <p className="mt-1 text-xs text-gray-400">
                Only POs at or above this total need approval.
              </p>
            </div>
          </div>
        </div>

        {/* Billing */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Billing</h2>
          <div className="space-y-4">
            <Toggle
              checked={settings.autoGenerateBill}
              onChange={(v) => patch({ autoGenerateBill: v })}
              title="Auto-generate vendor bill"
              desc="Create a draft bill automatically when a PO is validated."
            />
            <Toggle
              checked={settings.enable3WayMatching}
              onChange={(v) => patch({ enable3WayMatching: v })}
              title="Enable 3-way matching"
              desc="Match PO, receipt, and bill before payment."
            />
          </div>
        </div>

        {/* Receiving */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Receiving
          </h2>
          <div className="space-y-4">
            <Toggle
              checked={settings.allowPartialReceipts}
              onChange={(v) => patch({ allowPartialReceipts: v })}
              title="Allow partial receipts"
              desc="Permit receiving less than the ordered quantity."
            />
            <Toggle
              checked={settings.lockConfirmedOrders}
              onChange={(v) => patch({ lockConfirmedOrders: v })}
              title="Lock confirmed orders"
              desc="Block edits once a PO is confirmed."
            />
            <div>
              <label className={label}>Default Receiving Location</label>
              <input
                className={input}
                value={settings.defaultReceivingLocation}
                onChange={(e) =>
                  patch({ defaultReceivingLocation: e.target.value })
                }
                placeholder="e.g. Main Warehouse"
              />
            </div>
          </div>
        </div>

        {/* RFQ */}
        <div className={card}>
          <h2 className="mb-4 text-sm font-semibold text-gray-700">
            Requests for Quotation
          </h2>
          <div>
            <label className={label}>Default RFQ Validity (days)</label>
            <input
              type="number"
              min={0}
              max={365}
              className={input}
              value={settings.rfqValidityDays}
              onChange={(e) =>
                patch({ rfqValidityDays: Number(e.target.value) })
              }
            />
            <p className="mt-1 text-xs text-gray-400">
              New RFQs expire this many days after creation (0 = no default).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
