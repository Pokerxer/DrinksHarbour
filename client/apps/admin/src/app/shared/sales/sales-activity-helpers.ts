// client/apps/admin/src/app/shared/sales/sales-activity-helpers.ts

export type SalesActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'task'
  | 'log'
  | 'message';

export interface SalesActivityMeta {
  field?: string;
  from?: string | number;
  to?: string | number;
  total?: { from: number; to: number };
  untaxed?: { from: number; to: number };
}

export interface SalesActivityUser {
  _id?: string;
  name?: string;
  email?: string;
}

export interface SalesActivity {
  _id: string;
  type: SalesActivityType;
  subject: string;
  description?: string;
  system: boolean;
  meta?: SalesActivityMeta;
  createdBy?: SalesActivityUser | string;
  createdAt: string;
}

export interface ActivityDayGroup {
  label: string;
  items: SalesActivity[];
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(d, now)) return 'Today';
  if (isSameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Group activities (assumed newest-first) into day buckets, preserving order. */
export function groupByDay(items: SalesActivity[]): ActivityDayGroup[] {
  const groups: ActivityDayGroup[] = [];
  let current: ActivityDayGroup | null = null;
  for (const item of items) {
    const label = dayLabel(item.createdAt);
    if (!current || current.label !== label) {
      current = { label, items: [] };
      groups.push(current);
    }
    current.items.push(item);
  }
  return groups;
}

export function initialsFrom(name?: string): string {
  if (!name || !name.trim()) return 'SY';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + second).toUpperCase() || 'SY';
}

export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function userNameOf(createdBy?: SalesActivityUser | string): string | undefined {
  if (!createdBy) return undefined;
  if (typeof createdBy === 'string') return undefined;
  return createdBy.name || createdBy.email;
}
