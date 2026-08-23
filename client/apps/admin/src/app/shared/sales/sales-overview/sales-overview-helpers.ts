// Pure logic behind the /sales Overview page.
//
// Every figure on that page comes from a server-side group-by aggregation
// (salesOrderService.list with `groupBy`), which counts ALL matching tenant
// orders — not just one page of them. This module turns those group tallies
// into business numbers and keeps the definitions in one tested place so no
// card can quietly redefine "booked" or "outstanding".
//
// Money definitions worth remembering:
// - Booked revenue = orders whose lifecycle has passed draft (confirmed or
//   further) minus cancelled. Drafts are intentions, not money.
// - Outstanding = fully-unpaid totals only. A 'partial' group's total holds
//   FULL order values; part of it is already collected (see paymentBadge).
//
// Vitest runs `environment: 'node'` here — nothing renderable may live in
// this file.

import type { SalesOrder, SalesOrderGroup } from '@/services/salesOrder.service';

export interface GroupTally {
  count: number;
  total: number;
}

/** Server groups keyed by their `_id` status. Absent statuses are simply absent. */
export type GroupTallies = Record<string, GroupTally>;

export function tallyGroups(
  groups: SalesOrderGroup[] | undefined
): GroupTallies {
  const out: GroupTallies = {};
  for (const g of groups ?? []) {
    out[g._id] = { count: g.count ?? 0, total: g.total ?? 0 };
  }
  return out;
}

function pick(tallies: GroupTallies, key: string): GroupTally {
  return tallies[key] ?? { count: 0, total: 0 };
}

function sumOf(tallies: GroupTallies, keys: string[]): GroupTally {
  return keys.reduce<GroupTally>(
    (acc, k) => {
      const t = pick(tallies, k);
      return { count: acc.count + t.count, total: acc.total + t.total };
    },
    { count: 0, total: 0 }
  );
}

export interface MonthRange {
  dateFrom: string;
  dateTo: string;
}

/** Month-to-date window for the server's createdAt $gte/$lte filter. */
export function monthToDateRange(now: Date = new Date()): MonthRange {
  return {
    dateFrom: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    dateTo: now.toISOString(),
  };
}

const BOOKED_STATUSES = ['confirmed', 'partially_fulfilled', 'fulfilled'];

export interface BookedResult {
  revenue: number;
  count: number;
}

export function bookedThisMonth(tallies: GroupTallies): BookedResult {
  const { count, total } = sumOf(tallies, BOOKED_STATUSES);
  return { revenue: total, count };
}

export interface ToDeliverResult {
  count: number;
  value: number;
}

export function toDeliver(tallies: GroupTallies): ToDeliverResult {
  // Fulfilled work is done — only confirmed and half-shipped orders remain.
  const { count, total } = sumOf(tallies, ['confirmed', 'partially_fulfilled']);
  return { count, value: total };
}

export interface OpenQuotesResult {
  count: number;
  value: number;
  expired: number;
}

export function openQuotations(tallies: GroupTallies): OpenQuotesResult {
  const { count, total } = sumOf(tallies, ['draft', 'sent']);
  return { count, value: total, expired: pick(tallies, 'expired').count };
}

export interface UnpaidResult {
  unpaidTotal: number;
  unpaidCount: number;
  partialCount: number;
}

export function unpaidBalance(tallies: GroupTallies): UnpaidResult {
  const unpaid = pick(tallies, 'unpaid');
  return {
    unpaidTotal: unpaid.total,
    unpaidCount: unpaid.count,
    partialCount: pick(tallies, 'partial').count,
  };
}

/** Newest-first merge of two document lists, capped at `limit`. */
export function mergeRecentDocs(
  a: SalesOrder[],
  b: SalesOrder[],
  limit: number
): SalesOrder[] {
  const time = (d: SalesOrder) =>
    d.createdAt ? new Date(d.createdAt).getTime() : 0;
  return [...a, ...b]
    .sort((x, y) => time(y) - time(x))
    .slice(0, Math.max(0, limit));
}

/** Compact relative timestamp for feed rows; falls back to a fixed date. */
export function relTime(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diffMs = now.getTime() - then;
  if (diffMs < 60_000) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
