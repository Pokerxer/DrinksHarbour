'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  PiArrowClockwise,
  PiArrowsCounterClockwise,
  PiLightning,
  PiPlayCircle,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { reorderService, type ReorderRule } from '@/services/reorder.service';

const TRIGGER_LABEL: Record<string, string> = {
  min_quantity: 'Min quantity',
  reorder_point: 'Reorder point',
  days_of_stock: 'Days of stock',
  forecast_based: 'Forecast',
  manual: 'Manual',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-600',
  paused: 'bg-amber-50 text-amber-600',
  disabled: 'bg-gray-100 text-gray-500',
};

function ruleProduct(rule: ReorderRule): string {
  const p = rule.product as { name?: string } | undefined;
  const sp = rule.subProduct as { sku?: string } | undefined;
  return p?.name ?? sp?.sku ?? rule.name;
}

/**
 * Replenishment: the tenant's reordering rules (Odoo-style), with a manual
 * "run all checks" action and per-rule trigger. Rules are created per product
 * from the product's inventory tab.
 */
export default function InventoryReplenishment() {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [rules, setRules] = useState<ReorderRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = (await reorderService.getRules(token, { limit: 100 })) as {
        data?: ReorderRule[];
      };
      setRules(res.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function runChecks() {
    setChecking(true);
    try {
      const res = (await reorderService.checkAllRules(token)) as {
        message?: string;
      };
      toast.success(res.message ?? 'Rules checked');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run checks');
    } finally {
      setChecking(false);
    }
  }

  async function trigger(rule: ReorderRule) {
    setTriggering(rule._id);
    try {
      await reorderService.triggerRule(
        rule._id,
        token,
        'Manual trigger from Inventory → Replenishment'
      );
      toast.success(`${rule.name} triggered`);
      load();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to trigger rule'
      );
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div className="p-4 md:p-5 lg:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Replenishment</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Reordering rules that keep stock above your thresholds. Rules are
            managed per product on its inventory tab.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runChecks}
            disabled={checking}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiLightning className="h-4 w-4" />
            {checking ? 'Checking…' : 'Run all checks'}
          </button>
          <button
            type="button"
            onClick={load}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <PiArrowClockwise className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-3 font-medium">Rule</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Trigger</th>
                <th className="px-4 py-3 text-right font-medium">Reorder at</th>
                <th className="px-4 py-3 text-right font-medium">Order qty</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Triggered</th>
                <th className="px-4 py-3 text-right font-medium">Run</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-400"
                  >
                    Loading rules…
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center">
                    <PiArrowsCounterClockwise className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-400">
                      No reordering rules yet — add one from a product&apos;s
                      inventory tab.
                    </p>
                    <Link
                      href={routes.eCommerce.subProducts}
                      className="mt-2 inline-block text-sm font-medium text-[#b20202] hover:underline"
                    >
                      Go to products
                    </Link>
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr
                    key={rule._id}
                    className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {rule.name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {ruleProduct(rule)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {TRIGGER_LABEL[rule.triggerType] ?? rule.triggerType}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {rule.triggerType === 'days_of_stock'
                        ? `${rule.daysOfStock} days`
                        : rule.reorderPoint || rule.minQuantity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {rule.orderQuantity}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {rule.vendorName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${
                          STATUS_BADGE[rule.status] ?? STATUS_BADGE.disabled
                        }`}
                      >
                        {rule.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {rule.triggerCount}×
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={triggering === rule._id}
                        onClick={() => trigger(rule)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-[#b20202]/30 hover:text-[#b20202] disabled:opacity-40"
                      >
                        <PiPlayCircle className="h-4 w-4" />
                        {triggering === rule._id ? 'Running…' : 'Trigger'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
