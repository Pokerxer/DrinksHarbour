// @ts-nocheck
'use client';

import { useEffect } from 'react';
import {
  PiWarningCircle, PiPackage, PiArrowCounterClockwise,
  PiCheckCircle, PiEnvelope, PiDeviceMobile,
  PiDesktop, PiTrendDown, PiLightning, PiBell,
} from 'react-icons/pi';
import type { AlertSettings } from '../shared/types';

const STORAGE_KEY = 'dh_alert_settings';

interface AlertsTabProps {
  availableStock: number;
  totalStock: number;
  lowStockThreshold: number;
  reorderPoint: number;
  daysUntilStockout: number;
  recommendedOrderQty: number;
  dailySalesRate: number;
  onDailySalesRateChange: (rate: number) => void;
  onLowStockThresholdChange: (v: number) => void;
  onReorderPointChange: (v: number) => void;
  alertSettings: AlertSettings;
  onAlertSettingsChange: (settings: AlertSettings) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-gray-800' : 'bg-gray-200'}`}>
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
        <p className="text-xs font-bold text-gray-700">{title}</p>
        {desc && <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ToggleRow({ label, desc, icon, checked, onChange }: {
  label: string; desc: string; icon: React.ReactNode; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">{icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-800">{label}</p>
          <p className="text-[11px] text-gray-400">{desc}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export function AlertsTab({
  availableStock,
  totalStock,
  lowStockThreshold,
  reorderPoint,
  daysUntilStockout,
  recommendedOrderQty,
  dailySalesRate,
  onDailySalesRateChange,
  onLowStockThresholdChange,
  onReorderPointChange,
  alertSettings,
  onAlertSettingsChange,
}: AlertsTabProps) {
  const set = (key: keyof AlertSettings, value: any) =>
    onAlertSettingsChange({ ...alertSettings, [key]: value });

  // Persist alert notification prefs to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        onAlertSettingsChange({ ...alertSettings, ...parsed });
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        emailNotifications:  alertSettings.emailNotifications,
        smsNotifications:    alertSettings.smsNotifications,
        inAppNotifications:  alertSettings.inAppNotifications,
        alertFrequency:      alertSettings.alertFrequency,
        notifyEmails:        alertSettings.notifyEmails,
        lowStockEnabled:     alertSettings.lowStockEnabled,
        outOfStockEnabled:   alertSettings.outOfStockEnabled,
        reorderEnabled:      alertSettings.reorderEnabled,
      }));
    } catch {}
  }, [alertSettings]);

  // Stock health
  const isOut        = availableStock === 0;
  const isLow        = !isOut && availableStock <= lowStockThreshold;
  const needsReorder = !isOut && availableStock <= reorderPoint;
  const pct          = totalStock > 0 ? Math.min(100, Math.round((availableStock / totalStock) * 100)) : 0;
  const healthColor  = isOut ? 'bg-red-500' : isLow ? 'bg-amber-400' : needsReorder ? 'bg-blue-400' : 'bg-green-500';
  const healthLabel  = isOut ? 'Out of Stock' : isLow ? 'Low Stock' : needsReorder ? 'Reorder Needed' : 'Healthy';
  const healthCls    = isOut ? 'text-red-600' : isLow ? 'text-amber-600' : needsReorder ? 'text-blue-600' : 'text-green-600';

  const stockoutColor =
    daysUntilStockout < 7  ? 'text-red-600'   :
    daysUntilStockout < 30 ? 'text-amber-600' : 'text-green-600';

  const activeAlerts = [
    isOut        && { icon: <PiPackage />,           label: 'Out of Stock',       cls: 'bg-red-50 border-red-200 text-red-700' },
    isLow        && { icon: <PiWarningCircle />,     label: `Low stock: ${availableStock} left`, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
    needsReorder && { icon: <PiArrowCounterClockwise />, label: `Below reorder point (${reorderPoint})`, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
  ].filter(Boolean) as { icon: React.ReactNode; label: string; cls: string }[];

  return (
    <div className="space-y-5">

      {/* ── Active alert banners ── */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium ${a.cls}`}>
              <span className="h-4 w-4 shrink-0">{a.icon}</span>
              {a.label}
              <PiBell className="ml-auto h-3.5 w-3.5 animate-pulse opacity-70" />
            </div>
          ))}
        </div>
      )}

      {/* ── Stock health bar ── */}
      <Section title="Stock Health">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-bold ${healthCls}`}>{healthLabel}</span>
            <span className="text-xs text-gray-500 tabular-nums">
              {availableStock} / {totalStock} units available ({pct}%)
            </span>
          </div>

          {/* Main bar */}
          <div className="relative h-3 w-full rounded-full bg-gray-100">
            <div className={`h-3 rounded-full transition-all ${healthColor}`} style={{ width: `${pct}%` }} />
            {/* Threshold markers */}
            {totalStock > 0 && (
              <>
                {lowStockThreshold > 0 && (
                  <div
                    className="absolute top-0 h-3 w-0.5 bg-amber-500"
                    style={{ left: `${Math.min(100, (lowStockThreshold / totalStock) * 100)}%` }}
                    title={`Low stock threshold: ${lowStockThreshold}`}
                  />
                )}
                {reorderPoint > 0 && (
                  <div
                    className="absolute top-0 h-3 w-0.5 bg-blue-500"
                    style={{ left: `${Math.min(100, (reorderPoint / totalStock) * 100)}%` }}
                    title={`Reorder point: ${reorderPoint}`}
                  />
                )}
              </>
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Low Stock Threshold ({lowStockThreshold})</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Reorder Point ({reorderPoint})</span>
          </div>
        </div>
      </Section>

      {/* ── Threshold settings (saves with form) ── */}
      <Section title="Alert Thresholds" desc="Changes save with the product form">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Low Stock Threshold
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 focus-within:border-amber-400">
              <PiWarningCircle className="ml-3 h-4 w-4 shrink-0 text-amber-500" />
              <input
                type="number" min="0" step="1"
                value={lowStockThreshold}
                onChange={e => onLowStockThresholdChange(parseInt(e.target.value) || 0)}
                className="flex-1 px-2 py-2 text-sm focus:outline-none tabular-nums"
              />
              <span className="border-l border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] text-gray-400">units</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Alert fires when available stock ≤ this value</p>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Reorder Point
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 focus-within:border-blue-400">
              <PiArrowCounterClockwise className="ml-3 h-4 w-4 shrink-0 text-blue-500" />
              <input
                type="number" min="0" step="1"
                value={reorderPoint}
                onChange={e => onReorderPointChange(parseInt(e.target.value) || 0)}
                className="flex-1 px-2 py-2 text-sm focus:outline-none tabular-nums"
              />
              <span className="border-l border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] text-gray-400">units</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Trigger reorder suggestion when stock reaches this level</p>
          </div>
        </div>
      </Section>

      {/* ── Alert triggers ── */}
      <Section title="Alert Triggers">
        <div className="space-y-2">
          <ToggleRow
            label="Low Stock Alerts"
            desc="Notify when stock falls below the threshold"
            icon={<PiWarningCircle className="h-4 w-4" />}
            checked={alertSettings.lowStockEnabled}
            onChange={v => set('lowStockEnabled', v)}
          />
          <ToggleRow
            label="Out of Stock Alerts"
            desc="Notify when stock reaches zero"
            icon={<PiPackage className="h-4 w-4" />}
            checked={alertSettings.outOfStockEnabled}
            onChange={v => set('outOfStockEnabled', v)}
          />
          <ToggleRow
            label="Reorder Point Alerts"
            desc="Notify when the reorder point is reached"
            icon={<PiArrowCounterClockwise className="h-4 w-4" />}
            checked={alertSettings.reorderEnabled}
            onChange={v => set('reorderEnabled', v)}
          />
        </div>
      </Section>

      {/* ── Notification channels ── */}
      <Section title="Notification Channels" desc="Saved locally in this browser">
        <div className="space-y-2">
          <ToggleRow
            label="Email Notifications"
            desc="Receive alerts in your inbox"
            icon={<PiEnvelope className="h-4 w-4" />}
            checked={alertSettings.emailNotifications}
            onChange={v => set('emailNotifications', v)}
          />
          {alertSettings.emailNotifications && (
            <div className="ml-10 mr-2">
              <input
                type="text"
                placeholder="email@example.com, another@example.com"
                value={alertSettings.notifyEmails || ''}
                onChange={e => set('notifyEmails', e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              />
            </div>
          )}
          <ToggleRow
            label="In-App Notifications"
            desc="Show alerts in the admin dashboard"
            icon={<PiDesktop className="h-4 w-4" />}
            checked={alertSettings.inAppNotifications}
            onChange={v => set('inAppNotifications', v)}
          />
          <ToggleRow
            label="SMS Notifications"
            desc="Receive alerts via SMS"
            icon={<PiDeviceMobile className="h-4 w-4" />}
            checked={alertSettings.smsNotifications}
            onChange={v => set('smsNotifications', v)}
          />
        </div>

        <div className="mt-4">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
            Alert Frequency
          </label>
          <select
            value={alertSettings.alertFrequency || 'immediate'}
            onChange={e => set('alertFrequency', e.target.value)}
            className="w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          >
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly Digest</option>
            <option value="daily">Daily Digest</option>
            <option value="weekly">Weekly Summary</option>
          </select>
        </div>
      </Section>

      {/* ── Stock Forecasting ── */}
      <Section title="Stock Forecasting">
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Daily Sales Rate
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 focus-within:border-gray-400">
              <PiTrendDown className="ml-3 h-4 w-4 shrink-0 text-gray-400" />
              <input
                type="number" min="0"
                value={dailySalesRate}
                onChange={e => onDailySalesRateChange(parseInt(e.target.value) || 0)}
                className="flex-1 px-2 py-2 text-sm focus:outline-none"
              />
              <span className="border-l border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] text-gray-400">units/day</span>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Estimated daily units sold</p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Days Until Stockout</p>
            <p className={`text-2xl font-black tabular-nums leading-none ${stockoutColor}`}>
              {daysUntilStockout === Infinity ? '∞' : daysUntilStockout}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {daysUntilStockout < 7 ? 'Critical — reorder now' : daysUntilStockout < 30 ? 'Order soon' : 'Stock level OK'}
            </p>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Recommended Order</p>
            <p className="text-2xl font-black tabular-nums leading-none text-blue-600">{recommendedOrderQty}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">units to order now</p>
          </div>
        </div>

        {/* Visual stockout timeline */}
        {dailySalesRate > 0 && availableStock > 0 && (
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Stock Runway</p>
            <div className="flex items-center gap-2">
              {[7, 14, 30, 60, 90].map(days => {
                const stockAtDay = Math.max(0, availableStock - dailySalesRate * days);
                const isGone     = stockAtDay === 0;
                const isLowAtDay = stockAtDay > 0 && stockAtDay <= lowStockThreshold;
                return (
                  <div key={days} className="flex-1 text-center">
                    <div className={`mx-auto mb-1 h-8 w-full rounded-md ${
                      isGone     ? 'bg-red-100'    :
                      isLowAtDay ? 'bg-amber-100'  : 'bg-green-100'
                    }`} style={{ opacity: isGone ? 0.5 : 1 }}>
                      <span className={`flex h-full items-center justify-center text-[10px] font-bold ${
                        isGone ? 'text-red-500' : isLowAtDay ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {isGone ? '0' : Math.round(stockAtDay)}
                      </span>
                    </div>
                    <p className="text-[9px] text-gray-400">{days}d</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-gray-400">Projected stock remaining at each interval based on {dailySalesRate} units/day</p>
          </div>
        )}
      </Section>
    </div>
  );
}
