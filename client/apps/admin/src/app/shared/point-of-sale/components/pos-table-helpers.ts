import type { POSTableSummary, TableStatus } from '../types';

/** Tailwind classes per table status for strip chips and map tiles. */
export function tableStatusClasses(status: TableStatus): string {
  switch (status) {
    case 'occupied':
      return 'border-red-300 bg-red-50 text-red-700';
    case 'reserved':
      return 'border-amber-300 bg-amber-50 text-amber-700';
    case 'inactive':
      return 'border-gray-200 bg-gray-100 text-gray-400 opacity-60';
    default:
      return 'border-gray-200 bg-white text-gray-700 hover:border-[#b20202] hover:text-[#b20202]';
  }
}

/** Group tables by section preserving sortOrder then name within each group. */
export function groupTablesBySection(
  tables: POSTableSummary[]
): Array<{ section: string; tables: POSTableSummary[] }> {
  const bySection = new Map<string, POSTableSummary[]>();
  for (const t of [...tables].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  )) {
    const key = t.section || 'Main';
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(t);
  }
  return Array.from(bySection.entries()).map(([section, ts]) => ({
    section,
    tables: ts,
  }));
}

/** "12m" / "1h 05m" elapsed label for an occupied tab's openedAt. */
export function tabElapsedLabel(openedAt?: string, now = new Date()): string {
  if (!openedAt) return '';
  const mins = Math.max(
    0,
    Math.floor((now.getTime() - new Date(openedAt).getTime()) / 60000)
  );
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
