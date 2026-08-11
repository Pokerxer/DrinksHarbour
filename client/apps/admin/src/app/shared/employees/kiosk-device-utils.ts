// What the kiosk pairing list SAYS, separated from how it draws.
//
// Vitest here runs `environment: 'node'` with no jsdom, so the page cannot be
// rendered under test — which is why every screen in this module has a
// `*-utils.ts` beside it and this one is no exception.
//
// The list exists to answer one question: which of these screens can I cut off
// without breaking the shop? Every rule below serves that question, and the
// most useful answer it gives is "Never used" — a token somebody generated,
// pasted nowhere, and left valid.

import type { KioskDevice } from '@/services/attendance.service';

/**
 * How recently a screen must have punched to be called online.
 *
 * The kiosk touches `lastSeenAt` whenever it resolves its session, which is on
 * load and after every scan — so a busy counter refreshes this well inside five
 * minutes, and a screen somebody unplugged drops off the list of live ones
 * quickly enough to be noticed.
 */
export const KIOSK_ONLINE_WINDOW_MS = 5 * 60_000;

const MS_PER_DAY = 86_400_000;

export interface KioskDeviceStatus {
  label: string;
  tone: 'ok' | 'muted' | 'danger';
}

/** Epoch ms, or null for anything unreadable. */
function msOf(value: unknown): number | null {
  if (typeof value !== 'string' || !value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * What one row in the pairing list says about a screen.
 *
 * Revocation is checked FIRST and unconditionally. `lastSeenAt` is written on
 * every use, so a device revoked this morning still carries a very recent
 * timestamp — reporting that one as "Online now" would say the opposite of the
 * only thing that matters about it, which is that its token is dead.
 *
 * An unreadable timestamp reads as "Never used" rather than throwing: a row
 * that cannot render would take the whole list with it, and this list is how a
 * screen that has gone missing gets cut off.
 */
export function kioskDeviceStatus(
  device: KioskDevice,
  now: number = Date.now()
): KioskDeviceStatus {
  if (!device.active || device.revokedAt) {
    return { label: 'Revoked', tone: 'danger' };
  }

  const seen = msOf(device.lastSeenAt);
  if (seen === null) return { label: 'Never used', tone: 'muted' };

  const ago = now - seen;
  if (ago < KIOSK_ONLINE_WINDOW_MS) return { label: 'Online now', tone: 'ok' };

  const days = Math.floor(ago / MS_PER_DAY);
  if (days < 1) return { label: 'Last used today', tone: 'ok' };
  if (days === 1) return { label: 'Last used yesterday', tone: 'muted' };
  return { label: `Last used ${days} days ago`, tone: 'muted' };
}
