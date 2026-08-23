// app/shared/purchases/transfer-receive-panel.test.ts
//
// Pure side-gating pieces of the two-party transfer workflow. The HTTP wiring
// lives in the detail page; the manager gate itself is enforced server-side
// (Task 5) — these helpers only decide which actions the UI offers.

import { describe, it, expect } from 'vitest';
import { canReceiveTransfer, outstandingOf } from './transfer-receive-panel-helpers';

const tr = (over: Record<string, unknown> = {}) => ({
  status: 'in_transit',
  destinationWarehouse: { _id: 'dst', managers: ['mgr-d'] },
  sourceWarehouse: { _id: 'src', managers: ['mgr-s'] },
  items: [{ quantity: 10, receivedQty: 4 }],
  ...over,
}) as never;

describe('transfer side gating', () => {
  it('destination manager can receive while in flight', () => {
    expect(canReceiveTransfer(tr(), 'mgr-d', false)).toBe(true);
    expect(canReceiveTransfer(tr({ status: 'confirmed' }), 'mgr-d', false)).toBe(false);
    expect(canReceiveTransfer(tr(), 'someone-else', false)).toBe(false);
    expect(canReceiveTransfer(tr(), 'someone-else', true)).toBe(true);
  });

  it('outstandingOf clamps to the requested quantity', () => {
    expect(outstandingOf({ quantity: 10, receivedQty: 4 })).toBe(6);
    expect(outstandingOf({ quantity: 5, receivedQty: 9 })).toBe(0);
  });
});
