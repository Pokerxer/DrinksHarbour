import { describe, it, expect } from 'vitest';
import { kioskDeviceStatus, KIOSK_ONLINE_WINDOW_MS } from './kiosk-device-utils';
import type { KioskDevice } from '@/services/attendance.service';

// The pairing list exists so a manager can answer one question: which of these
// screens can I cut off without breaking the shop? Every rule below serves that.

const NOW = new Date('2026-08-11T12:00:00.000Z').getTime();

const device = (over: Partial<KioskDevice> = {}): KioskDevice =>
  ({
    _id: 'd1',
    name: 'Front counter',
    tokenHint: 'x9f2',
    createdAt: '2026-08-01T09:00:00.000Z',
    lastSeenAt: null,
    revokedAt: null,
    active: true,
    ...over,
  }) as KioskDevice;

describe('what a paired screen’s row says', () => {
  it('calls a revoked screen revoked', () => {
    const status = kioskDeviceStatus(
      device({ active: false, revokedAt: '2026-08-10T09:00:00.000Z' }),
      NOW
    );
    expect(status.label).toBe('Revoked');
    expect(status.tone).toBe('danger');
  });

  it('says revoked even if the screen was punching a moment ago', () => {
    // lastSeenAt is written on every use, so a revoked device that was busy
    // until this morning has a very recent timestamp. Revocation is the answer
    // that matters — the token on that tablet is dead.
    const status = kioskDeviceStatus(
      device({
        active: false,
        revokedAt: '2026-08-11T11:59:00.000Z',
        lastSeenAt: '2026-08-11T11:59:00.000Z',
      }),
      NOW
    );
    expect(status.label).toBe('Revoked');
  });

  it('distinguishes a screen that was paired and never used', () => {
    // The most useful row in the list: somebody generated a token, pasted it
    // nowhere, and it is still valid. That is the one to revoke.
    const status = kioskDeviceStatus(device({ lastSeenAt: null }), NOW);
    expect(status.label).toBe('Never used');
  });

  it('calls a screen that punched moments ago online', () => {
    const status = kioskDeviceStatus(
      device({ lastSeenAt: new Date(NOW - 60_000).toISOString() }),
      NOW
    );
    expect(status.label).toBe('Online now');
    expect(status.tone).toBe('ok');
  });

  it('stops calling it online once it goes quiet', () => {
    const status = kioskDeviceStatus(
      device({
        lastSeenAt: new Date(NOW - KIOSK_ONLINE_WINDOW_MS - 1000).toISOString(),
      }),
      NOW
    );
    expect(status.label).not.toBe('Online now');
  });

  it('counts the days since a screen was last used', () => {
    const status = kioskDeviceStatus(
      device({ lastSeenAt: new Date(NOW - 3 * 86_400_000).toISOString() }),
      NOW
    );
    expect(status.label).toBe('Last used 3 days ago');
  });

  it('says yesterday rather than 1 days ago', () => {
    const status = kioskDeviceStatus(
      device({ lastSeenAt: new Date(NOW - 30 * 3_600_000).toISOString() }),
      NOW
    );
    expect(status.label).toBe('Last used yesterday');
  });

  it('says today for a screen last used this morning', () => {
    const status = kioskDeviceStatus(
      device({ lastSeenAt: new Date(NOW - 5 * 3_600_000).toISOString() }),
      NOW
    );
    expect(status.label).toBe('Last used today');
  });

  it('does not crash on a timestamp it cannot read', () => {
    // A row that cannot be rendered would take the whole settings list with it,
    // and the list is how a compromised screen gets revoked.
    const status = kioskDeviceStatus(device({ lastSeenAt: 'not a date' }), NOW);
    expect(status.label).toBe('Never used');
  });
});
