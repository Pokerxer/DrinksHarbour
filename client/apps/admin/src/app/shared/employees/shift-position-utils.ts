// shift-position-utils.ts — the arithmetic behind a shift template's crew.
//
// A template says "1 bartender-or-barback, 2 servers". Generating a range emits
// one open shift per required position per worked day. Everything the template
// editor and the fill drawer need to know about that lives here, because admin
// tests run environment: 'node' with no jsdom and cannot render a component —
// a decision inside a component is a decision nobody can test.
import type { ShiftTemplate } from '@/services/shift.service';
import { refId } from '@/services/orgStructure.service';

export interface ShiftPosition {
  _id: string | null;
  roles: string[];
  count: number;
}

export interface Seat {
  employee: string;
  position: string | null;
}

export interface SeatOption {
  /**
   * The position's id, as a `<select>` option value — so a legacy template's
   * null-id position surfaces as `''`, because the DOM has no null.
   *
   * **A consumer MUST map it back with `value || null` before storing it on a
   * `Seat`.** `remainingForPosition` compares positions with `===`, and
   * `'' === null` is false: a seat left holding `''` never counts against the
   * legacy position, so the drawer would report it open however many people
   * were on it. `seatOptionToPosition` does this — use it rather than
   * open-coding the check.
   */
  value: string;
  label: string;
  remaining: number;
  full: boolean;
}

/**
 * A `SeatOption.value` as a `Seat.position`. `''` is the legacy single-position
 * template, whose id is genuinely null — see the warning on `value`.
 */
export function seatOptionToPosition(value: string): string | null {
  return value || null;
}

/**
 * A template's positions, with a legacy single-role template normalised to one
 * position of count 1. Mirrors templatePositions in shift.helpers.js on the
 * server — the two must agree, so change them together.
 */
export function templatePositions(template: ShiftTemplate): ShiftPosition[] {
  const raw = Array.isArray(template?.positions) ? template.positions : [];
  const positions = raw
    .map((p) => ({
      _id: p?._id ? String(p._id) : null,
      roles: (Array.isArray(p?.roles) ? p.roles : []).map(refId).filter(Boolean),
      count: Math.max(1, Math.floor(Number(p?.count)) || 1),
    }))
    .filter((p) => p.roles.length);

  if (positions.length) return positions;

  const role = template?.role ? refId(template.role) : '';
  return role ? [{ _id: null, roles: [role], count: 1 }] : [];
}

/** "Bartender or Barback", "Server ×2". */
export function positionLabel(
  position: ShiftPosition,
  roleNames: Map<string, string>
): string {
  const names = position.roles.map((r) => roleNames.get(r) ?? 'Role removed');
  const joined = names.join(' or ');
  return position.count > 1 ? `${joined} ×${position.count}` : joined;
}

/** How many of this position are still unseated. Never negative. */
export function remainingForPosition(position: ShiftPosition, seats: Seat[]): number {
  const taken = seats.filter((s) => s.position === position._id).length;
  return Math.max(0, position.count - taken);
}

/**
 * The fill drawer's per-person dropdown. A full position is LABELLED full and
 * kept in the list rather than removed: an option that silently disappears
 * reads as a bug, and the server refuses it as `position_full` anyway.
 */
export function seatOptions(
  template: ShiftTemplate,
  seats: Seat[],
  roleNames: Map<string, string>
): SeatOption[] {
  return templatePositions(template).map((p) => {
    const remaining = remainingForPosition(p, seats);
    const base = positionLabel(p, roleNames);
    const suffix = remaining === 0 ? ' (full)' : p.count > 1 ? ` (${remaining} left)` : '';
    return {
      value: p._id ?? '',
      label: `${base}${suffix}`,
      remaining,
      full: remaining === 0,
    };
  });
}
