// Pure helpers for the org-structure config screens (departments, job
// positions, HR/planning roles).
//
// Kept free of React so they can be unit-tested: the admin's Vitest environment
// is `node` with no jsdom, so components cannot be rendered and any logic worth
// testing has to live outside them.

export type ActiveFilter = 'all' | 'active' | 'inactive';
export type OrgSort = 'name' | 'employees' | 'recent';

export interface OrgRowLike {
  name: string;
  /**
   * Optional: shift templates reuse this screen and have no headcount — nobody
   * is "assigned to" a template. A row without one sorts as zero rather than
   * being made to carry a number that means nothing.
   */
  employeeCount?: number;
  isActive: boolean;
  createdAt?: string;
}

/**
 * Translate the UI's tri-state filter into the API's `isActive` param.
 * `undefined` means "send nothing", which the API reads as both.
 */
export function activeFilterParam(filter: ActiveFilter): boolean | undefined {
  if (filter === 'active') return true;
  if (filter === 'inactive') return false;
  return undefined;
}

export type HeadcountTone = 'unset' | 'under' | 'met' | 'over';

/**
 * Compare actual headcount against a job position's target.
 *
 * A target of 0 means "no target set" rather than "nobody should hold this" —
 * expectedHeadcount defaults to 0 on every position, so treating 0 as a real
 * target would paint every un-configured position as over-staffed.
 */
export function headcountStatus(
  employeeCount: number,
  expectedHeadcount: number
): { tone: HeadcountTone; label: string } {
  const actual = Number(employeeCount) || 0;
  const target = Number(expectedHeadcount) || 0;

  if (target <= 0) {
    return {
      tone: 'unset',
      label: `${actual} ${actual === 1 ? 'person' : 'people'}`,
    };
  }
  if (actual < target) {
    return {
      tone: 'under',
      label: `${actual} of ${target} — ${target - actual} to hire`,
    };
  }
  if (actual > target) {
    return {
      tone: 'over',
      label: `${actual} of ${target} — ${actual - target} over`,
    };
  }
  return { tone: 'met', label: `${actual} of ${target}` };
}

/**
 * Sort rows for display. Returns a new array; the input is never mutated,
 * because the caller holds it in state.
 *
 * Every comparator falls back to name so the order is total — an unstable sort
 * over equal keys reshuffles rows on unrelated re-renders.
 */
export function sortOrgRows<T extends OrgRowLike>(
  rows: T[],
  sort: OrgSort
): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name);
  const copy = [...rows];

  if (sort === 'employees') {
    return copy.sort(
      (a, b) => (b.employeeCount ?? 0) - (a.employeeCount ?? 0) || byName(a, b)
    );
  }
  if (sort === 'recent') {
    return copy.sort((a, b) => {
      const at = a.createdAt ? Date.parse(a.createdAt) : 0;
      const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
      return bt - at || byName(a, b);
    });
  }
  return copy.sort(byName);
}

/**
 * Whether a name collides with an existing row, ignoring case and extra
 * whitespace — the same normalisation the server's unique index effectively
 * applies. Lets the form say so before the round trip returns a 409.
 *
 * @param excludeId - the row being edited, which cannot collide with itself
 */
export function isDuplicateName(
  name: string,
  rows: { _id: string; name: string }[],
  excludeId?: string
): boolean {
  const key = name.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) return false;
  return rows.some(
    (r) =>
      r._id !== excludeId &&
      r.name.trim().replace(/\s+/g, ' ').toLowerCase() === key
  );
}

/**
 * Build the id→name map the employee screens use to render a department, a
 * position or a role stored as a bare id.
 *
 * Employee records carry ids, not populated documents. Rather than making the
 * server populate them — which would reintroduce the id | doc | null ref shape
 * that has bitten this codebase before — the config lists are already loaded for
 * the pickers, so the lookup is free.
 */
export function buildLabelMap(
  rows: { _id: string; name: string }[]
): Map<string, string> {
  return new Map(rows.map((r) => [String(r._id), r.name]));
}

/** Resolve an id to its display name, falling back to a stable placeholder. */
export function labelFor(
  id: string | undefined | null,
  map: Map<string, string>
): string {
  if (!id) return '—';
  return map.get(String(id)) ?? 'Unknown';
}
