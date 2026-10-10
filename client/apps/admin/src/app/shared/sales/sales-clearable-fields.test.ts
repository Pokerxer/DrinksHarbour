import { describe, expect, it } from 'vitest';
import { clearableSalesFields } from './sales-clearable-fields';

const filled = {
  notes: 'Cloudbay Wyn City Enterprises Limited\n1310551509\nUBA',
  terms: 'Net 30',
  validUntil: '2026-12-31',
  warehouseId: '6a89bca3228e3d5fc055375e',
};

describe('clearableSalesFields', () => {
  it('sends the value the operator typed', () => {
    const out = clearableSalesFields({ ...filled, notes: 'Deliver before 5pm' });
    expect(out.notes).toBe('Deliver before 5pm');
    expect(out.terms).toBe('Net 30');
    expect(out.validUntil).toBe('2026-12-31');
    expect(out.warehouseId).toBe(filled.warehouseId);
  });

  // The bug: `notes || undefined` sent `undefined`, which the server reads as
  // "leave unchanged", so clearing the note silently did nothing.
  it('clears an emptied note with an empty string, never undefined', () => {
    const out = clearableSalesFields({ ...filled, notes: '' });
    expect(out.notes).toBe('');
    expect(out.notes).not.toBeUndefined();
  });

  it('clears emptied terms the same way', () => {
    expect(clearableSalesFields({ ...filled, terms: '' }).terms).toBe('');
  });

  // A Date and an ObjectId cannot be cast from '', so they clear with null.
  it('clears validUntil with null, not an empty string', () => {
    const out = clearableSalesFields({ ...filled, validUntil: '' });
    expect(out.validUntil).toBeNull();
  });

  it('clears warehouseId with null, not an empty string', () => {
    expect(clearableSalesFields({ ...filled, warehouseId: '' }).warehouseId).toBeNull();
  });

  it('clears notes without disturbing the other fields', () => {
    const out = clearableSalesFields({ ...filled, notes: '' });
    expect(out.terms).toBe('Net 30');
    expect(out.validUntil).toBe('2026-12-31');
    expect(out.warehouseId).toBe(filled.warehouseId);
  });

  it('never emits undefined for any field — that is the signal to change nothing', () => {
    const out = clearableSalesFields({ notes: '', terms: '', validUntil: '', warehouseId: '' });
    for (const [key, value] of Object.entries(out)) {
      expect(value, `${key} must not be undefined`).not.toBeUndefined();
    }
  });
});
