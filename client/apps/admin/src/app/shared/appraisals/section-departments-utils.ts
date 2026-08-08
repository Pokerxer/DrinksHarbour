/**
 * Per-section department scoping for the template editor (Phase 5 §9.1).
 *
 * The rule this file encodes, in one place, is that an EMPTY list means
 * "asked of everyone" — not "asked of nobody". That inversion is the whole
 * trap here: a multi-select with nothing ticked normally means an empty
 * result set, and reading it that way would silently produce a section no
 * employee is ever asked. The server's `filterSections` treats empty as
 * company-wide, so the editor must present it the same way or HR is looking at
 * a control that lies about what it does.
 */

export interface DepartmentOption {
  _id: string;
  name: string;
}

/**
 * Tick or untick one department on a section.
 *
 * Returns a NEW array — the editor's undo/redo stack diffs by identity, so
 * mutating in place would make a scope change invisible to Cmd+Z.
 */
export function toggleSectionDepartment(
  current: string[] | undefined,
  departmentId: string
): string[] {
  const list = current || [];
  return list.includes(departmentId)
    ? list.filter((id) => id !== departmentId)
    : [...list, departmentId];
}

/**
 * How this section's audience reads in one line.
 *
 * Names the departments rather than counting them up to a point: "Sales" and
 * "Sales, Operations" are the answer HR actually wants, and "2 departments"
 * makes them open the picker to find out which. Past three it does collapse,
 * because a full list stops being scannable and the picker is right there.
 */
export function describeSectionAudience(
  departments: string[] | undefined,
  options: DepartmentOption[]
): string {
  const ids = departments || [];
  if (ids.length === 0) return 'Everyone';

  const byId = new Map(options.map((o) => [o._id, o.name]));
  // An id with no matching option is a department that was deleted (or belongs
  // to another tenant) after this template was written. Reported as "1 other"
  // rather than dropped: a section silently narrowing its audience is exactly
  // the thing HR would never notice, and silently WIDENING it by treating the
  // list as empty would be worse still.
  const named = ids.map((id) => byId.get(id)).filter((n): n is string => Boolean(n));
  const unknown = ids.length - named.length;

  const parts: string[] = [];
  if (named.length <= 3) {
    parts.push(...named);
  } else {
    parts.push(`${named.length} departments`);
  }
  if (unknown > 0) parts.push(`${unknown} unknown`);
  return parts.join(', ');
}

/**
 * Is this section asked of the given employee's department?
 *
 * The client-side mirror of the server's `filterSections` department test,
 * used to preview a form as one department would see it. It is a PREVIEW: the
 * server filters the real thing, and this never gates a request.
 */
export function sectionAppliesToDepartment(
  departments: string[] | undefined,
  departmentId: string | null | undefined
): boolean {
  const ids = departments || [];
  if (ids.length === 0) return true;
  return Boolean(departmentId) && ids.includes(departmentId as string);
}

/**
 * Departments that are named by at least one section, in option order.
 *
 * Drives the editor's "preview as" picker: offering every department when only
 * two are ever singled out is a list of choices that all do the same thing.
 */
export function departmentsUsedBySections(
  sections: { departments?: string[] }[],
  options: DepartmentOption[]
): DepartmentOption[] {
  const used = new Set<string>();
  for (const s of sections || []) {
    for (const id of s.departments || []) used.add(id);
  }
  return options.filter((o) => used.has(o._id));
}
