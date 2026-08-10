// Formatting for the attendance rating — `/employees/attendance/[employeeId]`.
//
// FORMATTING ONLY. Every number here was computed on the server by
// attendanceRating.helpers.js, which needs the roster and approved time-off to
// do it. Recomputing any of it here would be a second definition of the rule,
// and the two would drift the first time a weight changed.
//
// Kept free of React for the usual reason: the admin's Vitest environment is
// `node` with no jsdom, so anything worth testing lives outside a component.

import { formatMinutes } from './shift-roster-utils';
import type {
  AttendanceRating,
  Departure,
  RatingBand,
  RatingComponent,
} from '@/services/attendance.service';

/** Tones the cards render with. Not colours — the page picks those. */
export type RatingTone = 'good' | 'warn' | 'bad' | 'neutral';

const BAND_LABELS: Record<RatingBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  needs_attention: 'Needs attention',
  // Not "0" and not "Poor": nobody was rostered in this window, so there is
  // nothing to have done badly at.
  unrated: 'Not rated',
};

export function bandLabel(band: RatingBand): string {
  return BAND_LABELS[band] ?? 'Not rated';
}

const BAND_TONES: Record<RatingBand, RatingTone> = {
  excellent: 'good',
  good: 'good',
  fair: 'warn',
  needs_attention: 'bad',
  // Neutral, never red. An unrated employee has not failed anything.
  unrated: 'neutral',
};

export function bandTone(band: RatingBand): RatingTone {
  return BAND_TONES[band] ?? 'neutral';
}

/**
 * A component rate as a percentage.
 *
 * An unmeasurable rate is a dash rather than 0% — 0% is a verdict, and the
 * absence of a denominator is not one.
 */
export function ratePercent(rate: number | null): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—';
  return `${Math.round(rate * 100)}%`;
}

export interface ComponentRow {
  key: keyof AttendanceRating['components'];
  label: string;
  detail: string;
  value: string;
  /** False when there was no denominator — the row stays, greyed. */
  measured: boolean;
  rate: number | null;
}

const COMPONENT_META: {
  key: ComponentRow['key'];
  label: string;
  unit: string;
}[] = [
  { key: 'attendance', label: 'Showed up', unit: 'shifts' },
  { key: 'punctuality', label: 'On time', unit: 'arrivals' },
  { key: 'completeness', label: 'Clean records', unit: '' },
  { key: 'duration', label: 'Stayed the shift', unit: '' },
];

function detailFor(c: RatingComponent, unit: string): string {
  // Kept in the list even when it could not be measured, so the reason the
  // score renormalised stays visible instead of a row silently vanishing.
  if (!c.of) return 'Nothing to measure';
  return unit ? `${c.count}/${c.of} ${unit}` : `${c.count}/${c.of}`;
}

export function componentRows(rating: AttendanceRating): ComponentRow[] {
  return COMPONENT_META.map(({ key, label, unit }) => {
    const c = rating.components[key];
    return {
      key,
      label,
      detail: detailFor(c, unit),
      value: ratePercent(c.rate),
      measured: c.rate !== null,
      rate: c.rate,
    };
  });
}

/** How the shift ended, in words. Empty when there was no shift to measure. */
export function departureLabel(d: Departure | null | undefined): string {
  if (!d) return '';
  switch (d.code) {
    case 'early':
      return `Left ${formatMinutes(d.minutes)} early`;
    case 'overtime':
      return `Stayed ${formatMinutes(d.minutes)} over`;
    case 'on_time':
      return 'Left on time';
    case 'open':
      // Its own answer, never "left early": never clocking out is a different
      // failure from going home, and the record cannot say when they left.
      return 'Never clocked out';
    default:
      return '';
  }
}

export function departureTone(d: Departure | null | undefined): RatingTone {
  if (!d) return 'neutral';
  switch (d.code) {
    case 'on_time':
      return 'good';
    case 'early':
    case 'open':
      return 'bad';
    // Staying late is not a fault, so it must not render as one.
    case 'overtime':
    default:
      return 'neutral';
  }
}

/** Overtime worked beyond the roster. Reported; it earns nothing. */
export function overtimeLabel(minutes: number): string {
  if (!minutes) return '';
  return `${formatMinutes(minutes)} overtime`;
}

/** Says why a gap in the roster is not held against anybody. */
export function excusedNote(excused: number): string {
  if (!excused) return '';
  const word = excused === 1 ? 'absence' : 'absences';
  return `${excused} ${word} excused (approved leave)`;
}
