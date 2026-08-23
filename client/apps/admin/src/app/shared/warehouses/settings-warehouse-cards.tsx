'use client';

// app/shared/warehouses/settings-warehouse-cards.tsx
//
// The Warehouses module of the settings page: five SectionCards covering
// General, Stock Control, Replenishment & Alerts, Transfers, and Batches &
// Expiry. Extracted from the (very large) settings page so the section is
// independently editable; save/discard ownership stays with the page.
//
// Consistency rules live in settings-helpers.ts — this component renders the
// resulting warnings banner and disables dependent controls.

import type {
  Warehouse,
  WarehouseSettings,
} from '@/services/warehouse.service';
import {
  PiArrowsClockwise,
  PiArrowUUpLeftBold,
  PiPackage,
  PiWarning,
  PiWarehouse,
} from 'react-icons/pi';
import { requiresBatchTracking, warehouseSettingsWarnings } from './settings-helpers';

type SetField = <K extends keyof WarehouseSettings>(
  k: K,
  v: WarehouseSettings[K]
) => void;

// Local row primitives mirroring the settings-page styling (kept local to
// avoid exporting internals from the page file).
function Row({
  label,
  sub,
  children,
  indent,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  indent?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-6 py-3.5 pr-6 ${
        indent ? 'bg-gray-50/60 pl-14' : 'pl-6'
      }`}
    >
      <div className="min-w-0">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-gray-400">{sub}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function CbRow({
  label,
  sub,
  checked,
  onChange,
  indent,
  disabled,
}: {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  indent?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={`flex cursor-pointer select-none items-center justify-between gap-6 py-3.5 pr-6 transition-colors ${
        indent
          ? 'bg-gray-50/60 pl-14 hover:bg-gray-100/70'
          : 'pl-6 hover:bg-gray-50'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <label className="min-w-0 cursor-pointer">
        <p className="text-[13.5px] text-gray-800">{label}</p>
        {sub && (
          <p className="mt-0.5 text-xs leading-snug text-gray-400">{sub}</p>
        )}
      </label>
      <span
        aria-hidden
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-[#b20202]' : 'bg-gray-200'
        } ${disabled ? 'opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </div>
  );
}

function RadioRow({
  label,
  sub,
  name,
  value,
  checked,
  onChange,
}: {
  label: string;
  sub?: string;
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div
      className="flex cursor-pointer select-none items-center justify-between gap-6 py-3 pl-14 pr-6 transition-colors hover:bg-gray-50"
      onClick={onChange}
    >
      <label className="flex min-w-0 cursor-pointer items-start gap-3">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#b20202]"
        />
        <span className="min-w-0">
          <span className="block text-[13.5px] text-gray-800">{label}</span>
          {sub && (
            <span className="mt-0.5 block text-xs leading-snug text-gray-400">
              {sub}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  prefix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  prefix?: string;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-colors focus-within:border-[#b20202] focus-within:ring-2 focus-within:ring-[#b20202]/20">
      {prefix && (
        <span className="flex select-none items-center border-r border-gray-100 bg-gray-50 px-3 text-sm font-medium text-gray-500">
          {prefix}
        </span>
      )}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 bg-transparent px-3 py-1.5 text-right text-sm text-gray-900 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      {suffix && (
        <span className="flex select-none items-center border-l border-gray-100 bg-gray-50 px-3 text-xs font-medium text-gray-400">
          {suffix}
        </span>
      )}
    </div>
  );
}

function SectionCard({
  id,
  icon,
  title,
  note,
  children,
}: {
  id?: string;
  icon: React.ReactNode;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#b20202]/10 text-[#b20202]">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {note && <span className="ml-auto text-xs text-gray-400">{note}</span>}
      </div>
      <div className="divide-y divide-gray-50">{children}</div>
    </div>
  );
}

export function WarehouseSettingsSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-3 px-6 py-6">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
            <span className="h-8 w-8 animate-pulse rounded-lg bg-gray-100" />
            <span className="h-4 w-40 animate-pulse rounded-full bg-gray-100" />
          </div>
          {[...Array(2)].map((_, j) => (
            <div
              key={j}
              className="flex items-center justify-between px-6 py-3.5"
            >
              <div className="space-y-1.5">
                <span className="block h-3.5 w-52 animate-pulse rounded-full bg-gray-100" />
                <span className="block h-3 w-72 animate-pulse rounded-full bg-gray-50" />
              </div>
              <span className="h-4 w-4 animate-pulse rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function SettingsWarehouseCards({
  wh,
  setWhField,
  warehouses,
  query = '',
}: {
  wh: WarehouseSettings;
  setWhField: SetField;
  warehouses: Warehouse[];
  /** Live sidebar search text - hides cards whose terms do not match. */
  query?: string;
}) {
  const warnings = warehouseSettingsWarnings(wh);
  const needsBatches = requiresBatchTracking(wh);
  const batchOffNote = 'Requires batch & expiry tracking';
  const q = query.trim().toLowerCase();
  const vis = (...terms: string[]) =>
    !q || terms.some((t) => t.toLowerCase().includes(q));

  return (
    <>
      {/* Consistency warnings — derived from settings-helpers */}
      {warnings.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700">
            <PiWarning size={14} />
            Review these settings
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {warnings.map((w) => (
              <li key={w} className="text-xs leading-relaxed text-amber-800">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      {vis('warehouse default low stock threshold general') && (
      <SectionCard id="wh_general" icon={<PiWarehouse size={16} />} title="General">
        <Row
          label="Default warehouse"
          sub="Pre-selected warehouse for new stock operations and receiving."
        >
          <select
            value={wh.defaultWarehouse}
            onChange={(e) => setWhField('defaultWarehouse', e.target.value)}
            className="max-w-[220px] truncate rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 shadow-sm focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/20"
          >
            <option value="">No default</option>
            {warehouses.map((w) => (
              <option key={w._id} value={w._id}>
                {w.name}
                {w.code ? ` (${w.code})` : ''}
              </option>
            ))}
          </select>
        </Row>
        <Row
          label="Low-stock threshold"
          sub="Stock at or below this quantity is flagged low across warehouse views."
        >
          <NumInput
            value={wh.lowStockThreshold}
            onChange={(v) => setWhField('lowStockThreshold', Math.max(0, Math.round(v)))}
            min={0}
            step={1}
            suffix="units"
          />
        </Row>
      </SectionCard>
      )}

      {vis('valuation fifo average negative stock control') && (
      <SectionCard
        id="wh_stock"
        icon={<PiPackage size={16} />}
        title="Stock Control"
      >
        <Row
          label="Valuation method"
          sub="How inventory cost is calculated when stock is consumed."
        >
          <span />
        </Row>
        <RadioRow
          label="FIFO"
          sub="First-in, first-out — consume the oldest stock first"
          name="wh_valuation"
          value="fifo"
          checked={wh.valuationMethod === 'fifo'}
          onChange={() => setWhField('valuationMethod', 'fifo')}
        />
        <RadioRow
          label="Average cost"
          sub="Weighted average of all stock on hand"
          name="wh_valuation"
          value="average"
          checked={wh.valuationMethod === 'average'}
          onChange={() => setWhField('valuationMethod', 'average')}
        />
        <CbRow
          label="Allow negative stock"
          sub="Permit issuing or transferring more than the quantity on hand. Turn off to block operations that would drive stock below zero."
          checked={wh.allowNegativeStock}
          onChange={(v) => setWhField('allowNegativeStock', v)}
        />
      </SectionCard>
      )}

      {vis('reorder point quantity replenishment overstock alert') && (
      <SectionCard
        id="wh_reorder"
        icon={<PiArrowUUpLeftBold size={16} />}
        title="Replenishment & Alerts"
      >
        <Row
          label="Reorder point"
          sub="Default quantity at or below which an item is due for reorder."
        >
          <NumInput
            value={wh.reorderPoint}
            onChange={(v) => setWhField('reorderPoint', Math.max(0, Math.round(v)))}
            min={0}
            step={1}
            suffix="units"
          />
        </Row>
        <Row
          label="Reorder quantity"
          sub="Default quantity suggested when an item is reordered."
        >
          <NumInput
            value={wh.reorderQuantity}
            onChange={(v) =>
              setWhField('reorderQuantity', Math.max(0, Math.round(v)))
            }
            min={0}
            step={1}
            suffix="units"
          />
        </Row>
        <CbRow
          label="Flag items below reorder point"
          sub="Highlight items at or below the reorder point in warehouse views, alongside the low-stock flag."
          checked={wh.flagBelowReorderPoint}
          onChange={(v) => setWhField('flagBelowReorderPoint', v)}
        />
        <CbRow
          label="Out-of-stock alerts"
          sub="Surface an alert when an item reaches zero on hand."
          checked={wh.outOfStockAlert}
          onChange={(v) => setWhField('outOfStockAlert', v)}
        />
        <Row
          label="Overstock ceiling"
          sub="On-hand quantity above which an item is flagged overstocked. Set 0 to disable."
        >
          <NumInput
            value={wh.overstockCeiling}
            onChange={(v) =>
              setWhField('overstockCeiling', Math.max(0, Math.round(v)))
            }
            min={0}
            step={1}
            suffix="units"
          />
        </Row>
      </SectionCard>
      )}

      {vis('transfer approval inter-warehouse move stock threshold') && (
      <SectionCard
        id="wh_transfers"
        icon={<PiArrowsClockwise size={16} />}
        title="Transfers"
      >
        <CbRow
          label="Allow inter-warehouse transfers"
          sub="Permit moving stock between warehouses. Turn off to lock stock to its warehouse."
          checked={wh.allowInterWarehouseTransfers}
          onChange={(v) => setWhField('allowInterWarehouseTransfers', v)}
        />
        <CbRow
          label="Require transfer approval"
          sub={
            wh.allowInterWarehouseTransfers
              ? 'Stock transfers must be approved before they are executed.'
              : 'Inter-warehouse transfers are disabled, so approval can never apply.'
          }
          disabled={!wh.allowInterWarehouseTransfers}
          checked={wh.requireTransferApproval}
          onChange={(v) => setWhField('requireTransferApproval', v)}
        />
        {wh.allowInterWarehouseTransfers && wh.requireTransferApproval && (
          <Row
            label="Approval threshold"
            sub="Only transfers at or above this stock value need approval. Set 0 to require approval for every transfer."
            indent
          >
            <NumInput
              value={wh.transferApprovalThreshold}
              onChange={(v) =>
                setWhField(
                  'transferApprovalThreshold',
                  Math.max(0, Math.round(v))
                )
              }
              min={0}
              step={1000}
              prefix="₦"
            />
          </Row>
        )}
      </SectionCard>
      )}

      {vis('batch expiry tracking near warning days') && (
      <SectionCard
        id="wh_batches"
        icon={<PiWarning size={16} />}
        title="Batches & Expiry"
      >
        <CbRow
          label="Track batches & expiry"
          sub="Record batch numbers and expiry dates on received stock for traceability."
          checked={wh.batchTrackingEnabled}
          onChange={(v) => setWhField('batchTrackingEnabled', v)}
        />
        {wh.batchTrackingEnabled && (
          <Row
            label="Near-expiry warning"
            sub="Highlight batches this many days before they expire. Set 0 to disable."
            indent
          >
            <NumInput
              value={wh.nearExpiryDays}
              onChange={(v) =>
                setWhField(
                  'nearExpiryDays',
                  Math.min(365, Math.max(0, Math.round(v)))
                )
              }
              min={0}
              max={365}
              suffix="days"
            />
          </Row>
        )}
        <CbRow
          label="Block expired stock"
          sub={
            needsBatches
              ? batchOffNote
              : 'Prevent selling or picking stock whose batch has passed its expiry date.'
          }
          disabled={needsBatches}
          indent
          checked={wh.blockExpiredStock}
          onChange={(v) => setWhField('blockExpiredStock', v)}
        />
        <CbRow
          label="FEFO picking"
          sub={
            needsBatches
              ? batchOffNote
              : 'Prefer first-expired-first-out — pick the batch closest to expiry first.'
          }
          disabled={needsBatches}
          indent
          checked={wh.fefoPicking}
          onChange={(v) => setWhField('fefoPicking', v)}
        />
        <CbRow
          label="Auto-quarantine expired batches"
          sub={
            needsBatches
              ? batchOffNote
              : 'Automatically move batches out of available stock once they expire.'
          }
          disabled={needsBatches}
          indent
          checked={wh.autoQuarantineExpired}
          onChange={(v) => setWhField('autoQuarantineExpired', v)}
        />
      </SectionCard>
      )}
    </>
  );
}
