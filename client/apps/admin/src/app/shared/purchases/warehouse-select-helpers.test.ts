// app/shared/purchases/warehouse-select-helpers.test.ts
import { describe, expect, it } from 'vitest';
import { pickSeedWarehouse } from './warehouse-select-helpers';
import type { Warehouse } from '@/services/warehouse.service';

const wh = (id: string, extra: Partial<Warehouse> = {}) =>
  ({
    _id: id,
    name: id.toUpperCase(),
    code: id,
    isActive: true,
    isDefault: false,
    ...extra,
  }) as Warehouse;

describe('pickSeedWarehouse', () => {
  const list = [wh('a'), wh('b', { isDefault: true }), wh('c')];

  it('keeps a choice the user has already made', () => {
    // A token refresh re-runs the loading effect; it must not clobber the pick.
    expect(pickSeedWarehouse(list, { current: 'c', setting: 'a' })).toBe('c');
  });

  it('prefers the PO/tenant setting over the isDefault flag', () => {
    expect(pickSeedWarehouse(list, { setting: 'a' })).toBe('a');
  });

  it('falls back to isDefault when there is no setting', () => {
    expect(pickSeedWarehouse(list, {})).toBe('b');
  });

  it('falls back to the first warehouse when none is flagged default', () => {
    expect(pickSeedWarehouse([wh('a'), wh('c')], {})).toBe('a');
  });

  it('ignores a setting pointing at a warehouse that no longer exists', () => {
    // A deleted or deactivated warehouse must not leave the select on a phantom
    // value — that would submit an id the server then rejects.
    expect(pickSeedWarehouse(list, { setting: 'deleted' })).toBe('b');
  });

  it('ignores a current value that is no longer in the list', () => {
    expect(pickSeedWarehouse(list, { current: 'gone' })).toBe('b');
  });

  it('returns "" for an empty list rather than undefined', () => {
    expect(pickSeedWarehouse([], { setting: 'a', current: 'c' })).toBe('');
  });
});
