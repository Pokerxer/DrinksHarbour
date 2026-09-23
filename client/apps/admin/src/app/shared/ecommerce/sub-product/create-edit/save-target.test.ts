import { describe, expect, it } from 'vitest';
import { subProductSaveTarget } from './save-target';

describe('sub-product write intent', () => {
  it('never creates through an automatic save, refresh or unmount', () => {
    expect(subProductSaveTarget({ isEditMode: false })).toBeNull();
  });
  it('allows creation only for an explicit form submission', () => {
    expect(
      subProductSaveTarget({ isEditMode: false, explicitCreate: true })
    ).toEqual({ kind: 'create' });
  });
  it('updates the route record when edit mode receives only a slug', () => {
    expect(
      subProductSaveTarget({ isEditMode: true, slug: 'existing-id' })
    ).toEqual({ kind: 'update', id: 'existing-id' });
  });
  it('cannot fall through from a missing edit target to creation', () => {
    expect(
      subProductSaveTarget({ isEditMode: true, explicitCreate: true })
    ).toBeNull();
  });
});
