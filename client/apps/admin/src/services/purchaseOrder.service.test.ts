// services/purchaseOrder.service.test.ts — the PO destination-warehouse readers.
//
// A PO's `warehouse` comes back populated ({_id, name, code}) from getPurchaseOrder but
// raw (a string id) from create/update. Every screen that seeds a picker from it has to
// handle both, so both readings live here rather than being re-derived per component.
import { describe, expect, it } from 'vitest';
import { warehouseIdOf, warehouseLabelOf } from './purchaseOrder.service';

describe('warehouseIdOf', () => {
  it('reads a populated warehouse', () => {
    expect(warehouseIdOf({ _id: 'wh1', name: 'Main', code: 'MN' })).toBe('wh1');
  });

  it('reads a raw id', () => {
    expect(warehouseIdOf('wh1')).toBe('wh1');
  });

  it('returns "" for an absent destination so a <select> stays controlled', () => {
    // undefined/null into a select's value would flip it to uncontrolled and React
    // would warn on the first user pick.
    expect(warehouseIdOf(undefined)).toBe('');
    expect(warehouseIdOf(null)).toBe('');
    expect(warehouseIdOf('')).toBe('');
  });

  it('returns "" for a populated ref that somehow lost its _id', () => {
    expect(warehouseIdOf({} as { _id: string })).toBe('');
  });
});

describe('warehouseLabelOf', () => {
  it('renders name and code together', () => {
    expect(warehouseLabelOf({ _id: 'wh1', name: 'Main', code: 'MN' })).toBe(
      'Main (MN)'
    );
  });

  it('drops the parenthetical when there is no code', () => {
    expect(warehouseLabelOf({ _id: 'wh1', name: 'Main' })).toBe('Main');
  });

  it('has no label for an unpopulated id — the caller shows a dash', () => {
    // A bare id must never be rendered as if it were a name.
    expect(warehouseLabelOf('wh1')).toBe('');
    expect(warehouseLabelOf(undefined)).toBe('');
  });
});
