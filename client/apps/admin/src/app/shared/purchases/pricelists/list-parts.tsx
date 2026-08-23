'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  PiArrowsClockwise,
  PiBell,
  PiCaretDown,
  PiListChecks,
  PiPlus,
  PiRobot,
  PiScales,
  PiStack,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import type { VendorPricelist } from '@/services/vendorPricelist.service';
import { fraunces } from '../purchases-fonts';
import { isBigJump } from './helpers';
import type { SortKey } from './constants';

export type Tab = 'lists' | 'compare';
export type StatusFilter = 'all' | 'active' | 'inactive';
export type SourceFilter = 'all' | 'auto' | 'manual';

export const STATUS_OPTIONS: StatusFilter[] = ['all', 'active', 'inactive'];
export const SOURCE_OPTIONS: SourceFilter[] = ['all', 'auto', 'manual'];
export const SORT_OPTIONS: SortKey[] = ['recent', 'name', 'vendor', 'items'];

export const isAutoList = (pl: VendorPricelist): boolean =>
  Boolean(pl.autoManaged || pl.source === 'auto');

export interface ListParams {
  tab: Tab;
  q: string;
  status: StatusFilter;
  source: SourceFilter;
  sort: SortKey;
}

function pickParam<T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T {
  return raw !== null && (allowed as readonly string[]).includes(raw) ? (raw as T) : fallback;
}

export function parseListParams(sp: {
  get(k: string): string | null;
}): ListParams {
  return {
    tab: pickParam(sp.get('tab'), ['lists', 'compare'] as const, 'lists'),
    q: sp.get('q') ?? '',
    status: pickParam(sp.get('status'), STATUS_OPTIONS, 'all'),
    source: pickParam(sp.get('source'), SOURCE_OPTIONS, 'all'),
    sort: pickParam(sp.get('sort'), SORT_OPTIONS, 'recent'),
  };
}

export function filterSortLists(
  lists: VendorPricelist[],
  params: Pick<ListParams, 'q' | 'status' | 'source' | 'sort'>
): VendorPricelist[] {
  let out = [...lists];
  const needle = params.q.trim().toLowerCase();
  if (needle) {
    out = out.filter(
      (l) =>
        l.name?.toLowerCase().includes(needle) ||
        l.vendorName?.toLowerCase().includes(needle)
    );
  }
  if (params.status !== 'all') {
    out = out.filter((l) => (params.status === 'active' ? l.isActive : !l.isActive));
  }
  if (params.source !== 'all') {
    out = out.filter((l) => isAutoList(l) === (params.source === 'auto'));
  }
  out.sort((a, b) => {
    switch (params.sort) {
      case 'name':
        return (a.name ?? '').localeCompare(b.name ?? '');
      case 'vendor':
        return (a.vendorName ?? '').localeCompare(b.vendorName ?? '');
      case 'items':
        return (b.items?.length ?? 0) - (a.items?.length ?? 0);
      default:
        return (
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
        );
    }
  });
  return out;
}

export function computeKpis(lists: VendorPricelist[]) {
  return {
    total: lists.length,
    auto: lists.filter(isAutoList).length,
    lines: lists.reduce((s, l) => s + (l.items?.length ?? 0), 0),
    alerts: lists.reduce(
      (s, l) => s + (l.items?.filter((it) => isBigJump(it)).length ?? 0),
      0
    ),
  };
}

export function PageHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#ece4d6] bg-white px-6 py-5 shadow-sm">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#b20202] via-[#d9a05b] to-[#b20202]" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#b20202]/70">Configuration</p>
          <h1 className={`${fraunces.className} mt-1 text-[28px] font-semibold leading-tight text-[#2a2420] sm:text-[32px]`}>Vendor Pricelists</h1>
          <p className="mt-1 text-sm text-gray-500">
            Negotiated catalogues and per-vendor pricing for purchasing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button" onClick={onRefresh} title="Refresh"
            className="group flex items-center gap-1.5 rounded-lg border border-[#ece4d6] bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition-colors hover:border-[#b20202]/30 hover:bg-[#b20202]/5 hover:text-[#b20202]"
          >
            <PiArrowsClockwise className="h-3.5 w-3.5 transition-transform duration-500 group-active:-rotate-180" />
            Refresh
          </button>
          <Link
            href={routes.eCommerce.createVendorPricelist}
            className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#9a0101]"
          >
            <PiPlus className="h-4 w-4" /> New Pricelist
          </Link>
        </div>
      </div>
    </div>
  );
}

export function KpiStrip({
  kpis,
}: {
  kpis: { total: number; auto: number; lines: number; alerts: number };
}) {
  const cards = [
    { label: 'Pricelists', value: kpis.total, Icon: PiListChecks },
    { label: 'Auto-managed', value: kpis.auto, Icon: PiRobot },
    { label: 'Price Lines', value: kpis.lines, Icon: PiStack },
    { label: 'Price Alerts', value: kpis.alerts, Icon: PiBell },
  ];
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((k) => (
        <div
          key={k.label}
          className="rounded-2xl border border-[#ece4d6] bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {k.label}
            </p>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#b20202]/10 text-[#b20202]">
              <k.Icon className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`${fraunces.className} mt-2 text-2xl font-semibold tabular-nums text-[#2a2420]`}
          >
            {k.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function TabsBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string; Icon: typeof PiListChecks }[] = [
    { id: 'lists', label: 'Pricelists', Icon: PiListChecks },
    { id: 'compare', label: 'Price Compare', Icon: PiScales },
  ];
  return (
    <div className="mb-4 flex items-center gap-1 border-b border-[#ece4d6]">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            active === t.id
              ? 'border-[#b20202] text-[#b20202]'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <t.Icon className="h-4 w-4" />
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex overflow-hidden rounded-lg border border-[#ece4d6]"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`px-3 py-2 text-xs font-semibold capitalize transition-colors ${
            value === o
              ? 'bg-[#b20202] text-white'
              : 'bg-white text-gray-500 hover:bg-[#FAF8F3]'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

export function SortHeader({
  label,
  param,
  sort,
  onSort,
  alignRight = false,
}: {
  label: string;
  param: SortKey;
  sort: SortKey;
  onSort: (k: SortKey) => void;
  alignRight?: boolean;
}) {
  const active = sort === param;
  return (
    <th className={`px-4 py-3 ${alignRight ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(param)}
        title={`Sort by ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-0.5 uppercase tracking-wider transition-colors ${
          active ? 'text-[#b20202]' : 'hover:text-gray-600'
        }`}
      >
        {label}
        {active && <PiCaretDown className="h-3 w-3" />}
      </button>
    </th>
  );
}

export function SelectAllCheckbox({
  allSelected,
  someSelected,
  onToggle,
}: {
  allSelected: boolean;
  someSelected: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allSelected}
      onChange={onToggle}
      aria-label={allSelected ? 'Deselect all' : 'Select all'}
      className="h-3.5 w-3.5 cursor-pointer accent-[#b20202]"
    />
  );
}
