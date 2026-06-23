// @ts-nocheck
'use client';

import { Controller, useFormContext } from 'react-hook-form';
import {
  PiWarningCircle, PiArrowCounterClockwise, PiPackage,
  PiCurrencyNgn, PiTag, PiInfo,
} from 'react-icons/pi';
import {
  TRACKING_OPTIONS, ROUTE_OPTIONS, VALUATION_METHODS,
  CURRENCY_SYMBOLS, getTrackingIcon, getRouteIcon,
} from '../shared/constants';

interface SettingsTabProps {
  tracking: string;
  valuation: string;
  routes: string[];
  standardPrice: number;
  costPrice: number;
  lowStockThreshold: number;
  reorderPoint: number;
  reorderQuantity: number;
  currency: string;
  onToggleRoute: (route: string) => void;
  onStandardPriceChange: (price: number) => void;
  onLowStockThresholdChange: (v: number) => void;
  onReorderPointChange: (v: number) => void;
  onReorderQuantityChange: (v: number) => void;
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

function NumberField({
  label, desc, value, onChange, min = 0, icon, accentCls = 'focus-within:border-gray-400',
}: {
  label: string; desc?: string; value: number; onChange: (v: number) => void;
  min?: number; icon?: React.ReactNode; accentCls?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
        {label}
      </label>
      <div className={`flex items-center overflow-hidden rounded-lg border border-gray-200 ${accentCls}`}>
        {icon && <span className="ml-3 shrink-0 text-gray-400">{icon}</span>}
        <input
          type="number" min={min} step="1"
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || 0)}
          className="flex-1 px-3 py-2 text-sm focus:outline-none tabular-nums"
        />
        <span className="border-l border-gray-200 bg-gray-50 px-2.5 py-2 text-[11px] text-gray-400 shrink-0">
          units
        </span>
      </div>
      {desc && <p className="mt-1 text-[10px] text-gray-400">{desc}</p>}
    </div>
  );
}

export function SettingsTab({
  tracking,
  valuation,
  routes,
  standardPrice,
  costPrice,
  lowStockThreshold,
  reorderPoint,
  reorderQuantity,
  currency,
  onToggleRoute,
  onStandardPriceChange,
  onLowStockThresholdChange,
  onReorderPointChange,
  onReorderQuantityChange,
}: SettingsTabProps) {
  const { control } = useFormContext();
  const currencySymbol = CURRENCY_SYMBOLS[currency] || '₦';

  return (
    <div className="space-y-5">

      {/* ── Inventory Tracking ── */}
      <Section title="Inventory Tracking" desc="How individual units are tracked for this product">
        <Controller
          name="subProductData.tracking"
          control={control}
          render={({ field: { onChange, value } }) => (
            <div className="grid gap-3 sm:grid-cols-3">
              {TRACKING_OPTIONS.map((option) => {
                const Icon     = getTrackingIcon(option.iconName);
                const selected = value === option.value;
                return (
                  <button key={option.value} type="button" onClick={() => onChange(option.value)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      selected ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon className={`h-5 w-5 ${selected ? 'text-white' : 'text-gray-500'}`} />
                      <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-gray-800'}`}>
                        {option.label}
                      </p>
                    </div>
                    <p className={`text-[11px] leading-snug ${selected ? 'text-gray-300' : 'text-gray-400'}`}>
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        />
      </Section>

      {/* ── Stock Thresholds ── */}
      <Section title="Stock Thresholds" desc="These values control when alerts and reorder rules trigger — saved with the product">
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Low Stock Threshold"
            desc="Alert fires when available stock drops to this level"
            value={lowStockThreshold}
            onChange={onLowStockThresholdChange}
            icon={<PiWarningCircle className="h-4 w-4 text-amber-500" />}
            accentCls="focus-within:border-amber-400"
          />
          <NumberField
            label="Reorder Point"
            desc="Trigger reorder suggestions at this stock level"
            value={reorderPoint}
            onChange={onReorderPointChange}
            icon={<PiArrowCounterClockwise className="h-4 w-4 text-blue-500" />}
            accentCls="focus-within:border-blue-400"
          />
          <NumberField
            label="Reorder Quantity"
            desc="How many units to suggest ordering each time"
            value={reorderQuantity}
            onChange={onReorderQuantityChange}
            icon={<PiPackage className="h-4 w-4 text-green-500" />}
            accentCls="focus-within:border-green-400"
          />
        </div>

        {/* Visual threshold indicator */}
        {reorderPoint > 0 && reorderQuantity > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
            <PiInfo className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
            <p className="text-[11px] text-blue-700 leading-relaxed">
              When stock hits <strong>{reorderPoint}</strong> units, a reorder suggestion for{' '}
              <strong>{reorderQuantity}</strong> units will be created.
              After restocking: <strong>{reorderPoint + reorderQuantity}</strong> units total.
            </p>
          </div>
        )}
      </Section>

      {/* ── Inventory Valuation ── */}
      <Section title="Inventory Valuation" desc="Method used to calculate the cost value of stock on hand">
        <Controller
          name="subProductData.valuation"
          control={control}
          render={({ field: { onChange, value } }) => (
            <div className="grid gap-3 sm:grid-cols-3 mb-4">
              {VALUATION_METHODS.map((method) => {
                const selected = value === method.value;
                return (
                  <button key={method.value} type="button" onClick={() => onChange(method.value)}
                    className={`rounded-xl border-2 p-4 text-left transition-all ${
                      selected ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <p className={`text-sm font-semibold mb-1 ${selected ? 'text-purple-800' : 'text-gray-800'}`}>
                      {method.label}
                    </p>
                    <p className={`text-[11px] leading-snug ${selected ? 'text-purple-700/70' : 'text-gray-400'}`}>
                      {method.description}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Standard Price ({currencySymbol})
            </label>
            <div className="flex items-center overflow-hidden rounded-lg border border-gray-200 focus-within:border-gray-400">
              <span className="ml-3 text-sm text-gray-400">{currencySymbol}</span>
              <input
                type="number" min="0" step="0.01"
                value={standardPrice || costPrice || ''}
                onChange={e => onStandardPriceChange(parseFloat(e.target.value) || 0)}
                placeholder="0.00"
                className="flex-1 px-2 py-2 text-sm focus:outline-none tabular-nums"
              />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Internal cost used for valuation and reporting</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              Cost Price ({currencySymbol})
            </label>
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 gap-2">
              <span className="text-sm font-semibold tabular-nums text-gray-700">
                {costPrice ? `${currencySymbol}${costPrice.toLocaleString('en-NG', { minimumFractionDigits: 2 })}` : '—'}
              </span>
              <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[9px] font-bold text-gray-500 uppercase">
                Auto
              </span>
            </div>
            <p className="mt-1 text-[10px] text-gray-400">Set from the Pricing tab — used as purchase cost baseline</p>
          </div>
        </div>
      </Section>

      {/* ── Currency ── */}
      <Section title="Currency" desc="Currency used for this product's pricing and reporting">
        <Controller
          name="subProductData.currency"
          control={control}
          render={({ field: { onChange, value } }) => (
            <div className="grid gap-3 sm:grid-cols-4">
              {Object.entries(CURRENCY_SYMBOLS).map(([code, symbol]) => {
                const selected = value === code;
                return (
                  <button key={code} type="button" onClick={() => onChange(code)}
                    className={`rounded-xl border-2 p-3 text-center transition-all ${
                      selected ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <p className={`text-lg font-black ${selected ? 'text-white' : 'text-gray-700'}`}>{symbol}</p>
                    <p className={`text-[11px] font-semibold mt-0.5 ${selected ? 'text-gray-300' : 'text-gray-500'}`}>{code}</p>
                  </button>
                );
              })}
            </div>
          )}
        />
      </Section>

      {/* ── Product Routes ── */}
      <Section title="Product Routes" desc="Supply chain routes enabled for this product">
        <div className="grid gap-3 sm:grid-cols-2">
          {ROUTE_OPTIONS.map((route) => {
            const Icon     = getRouteIcon(route.iconName);
            const selected = (routes || []).includes(route.value);
            return (
              <button key={route.value} type="button" onClick={() => onToggleRoute(route.value)}
                className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                  selected ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  selected ? 'bg-green-200 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-none ${selected ? 'text-green-800' : 'text-gray-800'}`}>
                    {route.label}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${selected ? 'text-green-700/70' : 'text-gray-400'}`}>
                    {route.description}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                  selected ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {selected ? 'On' : 'Off'}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

    </div>
  );
}
