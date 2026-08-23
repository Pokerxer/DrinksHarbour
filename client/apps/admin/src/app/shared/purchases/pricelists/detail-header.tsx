'use client';

import Link from 'next/link';
import {
  PiArrowLeft,
  PiCloudArrowDown,
  PiFloppyDisk,
  PiRobot,
  PiTrash,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { VendorPricelist } from '@/services/vendorPricelist.service';
import { fmtCur } from '../purchases-analytics-helpers';
import { fraunces } from '../purchases-fonts';

function vendorRefId(vendor: VendorPricelist['vendor']): string | undefined {
  if (typeof vendor === 'string') return vendor;
  if (vendor && typeof vendor === 'object' && '_id' in vendor) {
    const id = (vendor as { _id: unknown })._id;
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

/** Header card — title, dirty pill, instant actions, quick-stats strip. */
export default function DetailHeader({
  pl,
  dirty,
  totals,
  saving,
  saveDisabled,
  syncing,
  togglingActive,
  deleting,
  onSave,
  onToggleActive,
  onSyncFromLastPO,
  onRequestDelete,
}: {
  pl: VendorPricelist;
  dirty: boolean;
  totals: { lines: number; value: number; preferred: number; alerts: number };
  saving: boolean;
  saveDisabled: boolean;
  syncing: boolean;
  togglingActive: boolean;
  deleting: boolean;
  onSave: () => void;
  onToggleActive: () => void;
  onSyncFromLastPO: () => void;
  onRequestDelete: () => void;
}) {
  const hasVendor = Boolean(vendorRefId(pl.vendor));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202]" />
      <Link
        href={routes.eCommerce.vendorPricelists}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-[#b20202]"
      >
        <PiArrowLeft className="h-3.5 w-3.5" /> Pricelists
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">
            {pl.vendorName || 'Vendor pricelist'}
          </p>
          <h1
            className={`${fraunces.className} mt-1 flex flex-wrap items-center gap-2 text-[26px] font-semibold leading-tight text-[#2a2420] sm:text-[30px]`}
          >
            {pl.name}
            {dirty && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                Unsaved changes
              </span>
            )}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            {pl.autoManaged || pl.source === 'auto' ? (
              <span className="bg-[#b20202]/8 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-[#b20202]">
                <PiRobot className="h-3 w-3" /> Auto-managed
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-medium text-gray-500">
                Manual
              </span>
            )}
            {pl.lastSyncedPO?.poNumber && (
              <span className="text-gray-400">
                Last synced from{' '}
                <span className="font-medium text-gray-600">
                  {pl.lastSyncedPO.poNumber}
                </span>
                {pl.lastSyncedAt
                  ? ` · ${new Date(pl.lastSyncedAt).toLocaleDateString()}`
                  : ''}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleActive}
            disabled={togglingActive}
            aria-busy={togglingActive}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:animate-pulse disabled:opacity-60 ${
              pl.isActive
                ? 'bg-[#3d6b5c]/12 text-[#3d6b5c] hover:bg-[#3d6b5c]/20'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {togglingActive ? 'Saving…' : pl.isActive ? 'Active' : 'Inactive'}
          </button>
          {hasVendor && (
            <button
              type="button"
              onClick={onSyncFromLastPO}
              disabled={syncing}
              className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] px-3 py-2 text-xs font-semibold text-gray-600 hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202] disabled:opacity-50"
            >
              <PiCloudArrowDown className="h-3.5 w-3.5" />
              {syncing ? 'Syncing…' : 'Sync from last PO'}
            </button>
          )}
          <button
            type="button"
            onClick={onRequestDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-[#ece4d6] px-3 py-2 text-xs font-semibold text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
          >
            <PiTrash className="h-3.5 w-3.5" /> Delete
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            <PiFloppyDisk className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* quick stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#f1ece2] pt-4 sm:grid-cols-4">
        {[
          { label: 'Price Lines', value: String(totals.lines) },
          { label: 'Catalogue Value', value: fmtCur(totals.value, pl.currency) },
          { label: 'Preferred', value: String(totals.preferred) },
          { label: 'Price Alerts', value: String(totals.alerts) },
        ].map((s) => (
          <div key={s.label}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {s.label}
            </p>
            <p
              className={`${fraunces.className} mt-0.5 text-lg font-semibold tabular-nums text-[#2a2420]`}
            >
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
