'use client';

import Link from 'next/link';
import {
  PiCloudArrowDown,
  PiCopySimple,
  PiEye,
  PiRobot,
  PiToggleLeft,
  PiToggleRight,
  PiTrash,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { VendorPricelist } from '@/services/vendorPricelist.service';
import type { SortKey } from './constants';
import { isAutoList, SelectAllCheckbox, SortHeader } from './list-parts';

export interface RowHandlers {
  busyId: string | null;
  selected: Set<string>;
  onToggleCheck: (id: string) => void;
  onSync: (pl: VendorPricelist) => void;
  onToggleActive: (pl: VendorPricelist) => void;
  onDuplicate: (pl: VendorPricelist) => void;
  onDelete: (id: string) => void;
}

const actionBtn =
  'rounded p-1.5 text-gray-400 hover:text-current disabled:pointer-events-none';

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-[#3d6b5c]/12 text-[#3d6b5c]'
          : 'bg-gray-100 text-gray-500'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function SourceBadge({ auto }: { auto: boolean }) {
  return auto ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#b20202]/8 px-2 py-0.5 text-[11px] font-semibold text-[#b20202]">
      <PiRobot className="h-3 w-3" /> Auto
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
      Manual
    </span>
  );
}

function RowActions({
  pl,
  busy,
  h,
}: {
  pl: VendorPricelist;
  busy: boolean;
  h: RowHandlers;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5 text-gray-400">
      <button
        type="button" onClick={() => h.onSync(pl)} disabled={busy} title="Sync now from last PO"
        className={`${actionBtn} hover:bg-[#b20202]/10 hover:text-[#b20202]`}
      >
        <PiCloudArrowDown className="h-4 w-4" />
      </button>
      <Link
        href={routes.eCommerce.vendorPricelistDetails(pl._id)} title="View / edit"
        className={`${actionBtn} hover:bg-[#b20202]/10 hover:text-[#b20202]`}
      >
        <PiEye className="h-4 w-4" />
      </Link>
      <button
        type="button" onClick={() => h.onToggleActive(pl)} disabled={busy} title={pl.isActive ? 'Deactivate' : 'Activate'}
        className={`${actionBtn} hover:bg-gray-100 hover:text-gray-700`}
      >
        {pl.isActive ? (
          <PiToggleRight className="h-4 w-4 text-[#3d6b5c]" />
        ) : (
          <PiToggleLeft className="h-4 w-4" />
        )}
      </button>
      <button
        type="button" onClick={() => h.onDuplicate(pl)} disabled={busy} title="Duplicate"
        className={`${actionBtn} hover:bg-gray-100 hover:text-gray-700`}
      >
        <PiCopySimple className="h-4 w-4" />
      </button>
      <button
        type="button" onClick={() => h.onDelete(pl._id)} disabled={busy} title="Delete"
        className={`${actionBtn} hover:bg-red-50 hover:text-red-500`}
      >
        <PiTrash className="h-4 w-4" />
      </button>
    </div>
  );
}

function CheckCell({
  pl,
  h,
  boxCls = 'h-3.5 w-3.5',
}: {
  pl: VendorPricelist;
  h: RowHandlers;
  boxCls?: string;
}) {
  return (
    <input
      type="checkbox"
      checked={h.selected.has(pl._id)}
      onChange={() => h.onToggleCheck(pl._id)}
      aria-label={`Select ${pl.name}`}
      className={`${boxCls} shrink-0 cursor-pointer accent-[#b20202]`}
    />
  );
}

export function PricelistRow({
  pl,
  h,
}: {
  pl: VendorPricelist;
  h: RowHandlers;
}) {
  const busy = h.busyId === pl._id;
  const synced = pl.lastSyncedAt
    ? new Date(pl.lastSyncedAt).toLocaleDateString()
    : '—';
  return (
    <tr
      className={`transition-colors hover:bg-[#FAF8F3]/60 ${
        busy ? 'opacity-50' : ''
      }`}
    >
      <td className="px-4 py-3">
        <CheckCell pl={pl} h={h} />
      </td>
      <td className="px-4 py-3">
        <Link
          href={routes.eCommerce.vendorPricelistDetails(pl._id)}
          className="font-medium text-[#2a2420] hover:text-[#b20202]"
        >
          {pl.name}
        </Link>
      </td>
      <td className="px-4 py-3 text-gray-600">{pl.vendorName || '—'}</td>
      <td className="px-4 py-3">
        <SourceBadge auto={isAutoList(pl)} />
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">{synced}</td>
      <td className="px-4 py-3">
        <span className="rounded-md bg-[#FAF8F3] px-2 py-0.5 text-xs font-medium text-gray-600">
          {pl.currency}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-gray-600">
        {pl.items?.length ?? 0}
      </td>
      <td className="px-4 py-3">
        <StatusPill active={pl.isActive} />
      </td>
      <td className="px-4 py-3">
        <RowActions pl={pl} busy={busy} h={h} />
      </td>
    </tr>
  );
}

export function PricelistsTable({
  rows,
  sort,
  onSortChange,
  allSelected,
  someSelected,
  onToggleAll,
  handlers,
}: {
  rows: VendorPricelist[];
  sort: SortKey;
  onSortChange: (k: SortKey) => void;
  allSelected: boolean;
  someSelected: boolean;
  onToggleAll: () => void;
  handlers: RowHandlers;
}) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#ece4d6] bg-[#FAF8F3] text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            <th className="w-10 px-4 py-3">
              <SelectAllCheckbox
                allSelected={allSelected}
                someSelected={someSelected}
                onToggle={onToggleAll}
              />
            </th>
            <SortHeader label="Name" param="name" sort={sort} onSort={onSortChange} />
            <SortHeader label="Vendor" param="vendor" sort={sort} onSort={onSortChange} />
            <th className="px-4 py-3">Source</th>
            <SortHeader label="Last Synced" param="recent" sort={sort} onSort={onSortChange} />
            <th className="px-4 py-3">Currency</th>
            <SortHeader label="Lines" param="items" sort={sort} onSort={onSortChange} alignRight />
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1ece2]">
          {rows.map((pl) => (
            <PricelistRow key={pl._id} pl={pl} h={handlers} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PricelistsCards({
  rows,
  handlers,
}: {
  rows: VendorPricelist[];
  handlers: RowHandlers;
}) {
  return (
    <div className="space-y-3 p-3 md:hidden">
      {rows.map((pl) => {
        const busy = handlers.busyId === pl._id;
        return (
          <div
            key={pl._id}
            className={`rounded-2xl border border-[#ece4d6] bg-white p-4 shadow-sm ${
              busy ? 'opacity-50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={routes.eCommerce.vendorPricelistDetails(pl._id)}
                  className="block truncate font-medium text-[#2a2420] hover:text-[#b20202]"
                >
                  {pl.name}
                </Link>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {pl.vendorName || '—'} · {pl.items?.length ?? 0} lines
                </p>
              </div>
              <CheckCell pl={pl} h={handlers} boxCls="mt-1 h-4 w-4" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusPill active={pl.isActive} />
              <SourceBadge auto={isAutoList(pl)} />
              <span className="rounded-md bg-[#FAF8F3] px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
                {pl.currency}
              </span>
              {pl.lastSyncedAt && (
                <span className="text-[11px] text-gray-400">
                  Synced {new Date(pl.lastSyncedAt).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="mt-3 flex items-center justify-end gap-1 border-t border-[#f1ece2] pt-2.5 text-gray-400">
              <button
                type="button" onClick={() => handlers.onSync(pl)} disabled={busy} title="Sync now from last PO"
                className={`${actionBtn} hover:bg-[#b20202]/10 hover:text-[#b20202]`}
              >
                <PiCloudArrowDown className="h-4 w-4" />
              </button>
              <button
                type="button" onClick={() => handlers.onToggleActive(pl)} disabled={busy} title={pl.isActive ? 'Deactivate' : 'Activate'}
                className={`${actionBtn} hover:bg-gray-100 hover:text-gray-700`}
              >
                {pl.isActive ? (
                  <PiToggleRight className="h-4 w-4 text-[#3d6b5c]" />
                ) : (
                  <PiToggleLeft className="h-4 w-4" />
                )}
              </button>
              <button
                type="button" onClick={() => handlers.onDelete(pl._id)} disabled={busy} title="Delete"
                className={`${actionBtn} hover:bg-red-50 hover:text-red-500`}
              >
                <PiTrash className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
