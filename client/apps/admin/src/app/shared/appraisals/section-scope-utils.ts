/**
 * Per-section scoping for the template editor — by DEPARTMENT (Phase 5 §9.1)
 * and by JOB ROLE.
 *
 * The rule this file encodes, in one place, is that an EMPTY list means
 * "asked of everyone" — not "asked of nobody". That inversion is the whole
 * trap here: a multi-select with nothing ticked normally means an empty
 * result set, and reading it that way would silently produce a section no
 * employee is ever asked. The server's `filterSections` treats empty as
 * company-wide, so the editor must present it the same way or HR is looking at
 * a control that lies about what it does.
 *
 * The second rule is that the two lists are ANDed: a section naming both
 * Retail and Cashier is asked of Retail's cashiers, not of everyone in Retail
 * plus every cashier in the company. That matters because roles genuinely
 * cross departments — attendants sit in both Retail and Warehouse — so OR and
 * AND pick out visibly different people.
 *
 * Both dimensions go through the SAME functions rather than a department copy
 * and a role copy. They are the same rule over a different id list, and two
 * copies of an inverted-empty rule is two chances to get the inversion wrong
 * in only one of them.
 */

export interface ScopeOption {
  _id: string;
  name: string;
}

/** The two scoping lists a section carries. Both optional, both mean everyone when absent. */
export interface SectionScope {
  departments?: string[];
  roles?: string[];
}

/** Which of the two lists a helper is working on. */
export type ScopeKey = 'departments' | 'roles';

/** How each list names itself once it is too long to spell out. */
const PLURAL: Record<ScopeKey, string> = {
  departments: 'departments',
  roles: 'roles',
};

/**
 * Tick or untick one id on a section's scope list.
 *
 * Returns a NEW array — the editor's undo/redo stack diffs by identity, so
 * mutating in place would make a scope change invisible to Cmd+Z.
 */
export function toggleScopeId(
  current: string[] | undefined,
  id: string
): string[] {
  const list = current || [];
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * One scope list, in words. Empty is the caller's business — see
 * describeSectionAudience, which is the only thing that may say "Everyone".
 *
 * Names the entries rather than counting them up to a point: "Sales" and
 * "Sales, Operations" are the answer HR actually wants, and "2 departments"
 * makes them open the picker to find out which. Past three it does collapse,
 * because a full list stops being scannable and the picker is right there.
 */
function describeScopeList(
  ids: string[],
  options: ScopeOption[],
  key: ScopeKey
): string {
  const byId = new Map(options.map((o) => [o._id, o.name]));
  // An id with no matching option was deleted (or belongs to another tenant)
  // after this template was written. Reported as "1 unknown" rather than
  // dropped: a section silently narrowing its audience is exactly the thing HR
  // would never notice, and silently WIDENING it by treating the list as empty
  // would be worse still.
  const named = ids
    .map((id) => byId.get(id))
    .filter((n): n is string => Boolean(n));
  const unknown = ids.length - named.length;

  const parts: string[] = [];
  if (named.length <= 3) {
    parts.push(...named);
  } else {
    parts.push(`${named.length} ${PLURAL[key]}`);
  }
  if (unknown > 0) parts.push(`${unknown} unknown`);
  return parts.join(', ');
}

/**
 * How this section's audience reads in one line.
 *
 * The two dimensions are joined with a middle dot rather than "or", because
 * they intersect: "Sales · Cashier" reads as "Sales cashiers", which is who
 * the section reaches. Anything reading as "Sales or cashiers" would describe
 * a wider audience than the section has.
 */
export function describeSectionAudience(
  section: SectionScope,
  departmentOptions: ScopeOption[],
  roleOptions: ScopeOption[]
): string {
  const departments = section.departments || [];
  const roles = section.roles || [];
  if (departments.length === 0 && roles.length === 0) return 'Everyone';

  const parts: string[] = [];
  if (departments.length)
    parts.push(
      describeScopeList(departments, departmentOptions, 'departments')
    );
  if (roles.length) parts.push(describeScopeList(roles, roleOptions, 'roles'));
  return parts.join(' · ');
}

/**
 * Is this section asked of an employee in the given department, holding the
 * given roles?
 *
 * The client-side mirror of the server's `filterSections` scope test, used to
 * preview a form as one department or role would see it. It is a PREVIEW: the
 * server filters the real thing, and this never gates a request.
 */
export function sectionAppliesTo(
  section: SectionScope,
  {
    departmentId,
    roleIds,
  }: { departmentId?: string | null; roleIds?: string[] }
): boolean {
  const departments = section.departments || [];
  if (
    departments.length &&
    !(departmentId && departments.includes(departmentId))
  )
    return false;
  const roles = section.roles || [];
  const held = roleIds || [];
  if (roles.length && !roles.some((r) => held.includes(r))) return false;
  return true;
}

/**
 * The options named by at least one section, in option order.
 *
 * Drives the editor's "preview as" picker: offering every department when only
 * two are ever singled out is a list of choices that all do the same thing.
 */
export function scopeOptionsUsedBySections(
  sections: SectionScope[],
  key: ScopeKey,
  options: ScopeOption[]
): ScopeOption[] {
  const used = new Set<string>();
  for (const s of sections || []) {
    for (const id of s[key] || []) used.add(id);
  }
  return options.filter((o) => used.has(o._id));
}
