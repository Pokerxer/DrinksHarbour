import { describe, it, expect } from 'vitest';
import {
  STATUS_STEPS,
  TERMINAL_STATES,
  NEXT_STATUS,
  NEXT_LABEL,
  getStatusIndex,
} from './status-config';

describe('getStatusIndex', () => {
  it('maps each lifecycle status to its step', () => {
    expect(getStatusIndex('pending')).toBe(0);
    expect(getStatusIndex('confirmed')).toBe(1);
    expect(getStatusIndex('processing')).toBe(2);
    expect(getStatusIndex('shipped')).toBe(3);
    expect(getStatusIndex('delivered')).toBe(4);
  });

  it('sits partially_shipped at the shipped stage, not its own step', () => {
    expect(getStatusIndex('partially_shipped')).toBe(
      STATUS_STEPS.findIndex((s) => s.key === 'shipped')
    );
    expect(
      (STATUS_STEPS.map((s) => s.key) as string[]).includes(
        'partially_shipped'
      )
    ).toBe(false);
  });

  it('returns 0 for unknown statuses (defensive fallback)', () => {
    expect(getStatusIndex('mystery_status')).toBe(0);
  });
});

describe('lifecycle config integrity', () => {
  it('NEXT_STATUS only advances along happy-path steps', () => {
    for (const next of Object.values(NEXT_STATUS)) {
      expect(STATUS_STEPS.some((s) => s.key === next)).toBe(true);
    }
  });

  it('every NEXT_STATUS key has a matching label', () => {
    for (const key of Object.keys(NEXT_STATUS)) {
      expect(NEXT_LABEL[key]).toBeTruthy();
    }
  });

  it('terminal states are never a NEXT_STATUS target', () => {
    const targets = new Set(Object.values(NEXT_STATUS));
    for (const terminal of Object.keys(TERMINAL_STATES)) {
      expect(targets.has(terminal)).toBe(false);
    }
  });

  it('every tsKey is a real Order timestamp field name', () => {
    // Compile-time guarantee via `satisfies`; this pins the runtime contract.
    const valid = [
      'placedAt',
      'confirmedAt',
      'processingAt',
      'shippedAt',
      'deliveredAt',
      'cancelledAt',
    ];
    for (const step of STATUS_STEPS) expect(valid).toContain(step.tsKey);
    for (const t of Object.values(TERMINAL_STATES)) {
      if (t.tsKey) expect(valid).toContain(t.tsKey);
    }
  });
});
