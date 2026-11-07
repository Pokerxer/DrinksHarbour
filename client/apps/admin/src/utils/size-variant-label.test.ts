// DRI-14 — label consistency helpers (see utils/size-variant-label.ts).
import { describe, it, expect } from 'vitest';
import {
  sizeVariantLabel,
  lineSizeLabel,
  populatedSizeIdentity,
} from './size-variant-label';

describe('sizeVariantLabel (unchanged baseline)', () => {
  it('composes displayName · colorName · optionName', () => {
    expect(sizeVariantLabel({ displayName: 'One-size gown — Emerald', colorName: 'Emerald', optionName: 'Emerald gown' }))
      .toBe('One-size gown — Emerald · Emerald · Emerald gown');
    expect(sizeVariantLabel({ size: 'storage-256gb', optionName: '16 GB RAM' }))
      .toBe('storage-256gb · 16 GB RAM');
  });

  it('renders a colour-free (legacy) row with no separator', () => {
    expect(sizeVariantLabel({ displayName: 'Legacy Lager 750ml' })).toBe('Legacy Lager 750ml');
    expect(sizeVariantLabel({ size: '330ml' })).toBe('330ml');
    expect(sizeVariantLabel({})).toBe('');
  });
});

describe('populatedSizeIdentity', () => {
  it('narrows only populated Size objects', () => {
    expect(populatedSizeIdentity(undefined)).toBeNull();
    expect(populatedSizeIdentity('507f1f77bcf86cd799439011')).toBeNull();
    expect(populatedSizeIdentity({ _id: 'x', size: 'M' })).toBeNull();
    expect(populatedSizeIdentity({ size: 'M', colorName: 'Emerald' })).toEqual({ size: 'M', colorName: 'Emerald' });
    expect(populatedSizeIdentity({ size: 'one', optionName: 'Sand speaker' })).toBeDefined();
  });
});

describe('lineSizeLabel (stored snapshot vs composed identity)', () => {
  it('keeps the stored snapshot byte-for-byte when identity is absent or colour-free', () => {
    expect(lineSizeLabel({ sizeName: 'Legacy Lager 750ml' })).toBe('Legacy Lager 750ml');
    expect(lineSizeLabel({ sizeName: 'Legacy Lager 750ml' }, null)).toBe('Legacy Lager 750ml');
    expect(lineSizeLabel({ sizeName: 'Legacy Lager 750ml' }, { size: '750ml' })).toBe('Legacy Lager 750ml');
    // Same row as before DRI-14: byte-identical even with a populated Size.
    expect(lineSizeLabel({ sizeName: '330ml' }, { displayName: 'Lager 330ml', size: '330ml' })).toBe('330ml');
    expect(lineSizeLabel({})).toBe('');
  });

  it('composes via the shared formatter when the Size carries variant data', () => {
    expect(lineSizeLabel(
      { sizeName: 'One-size gown — Emerald' },
      { displayName: 'One-size gown — Emerald', colorName: 'Emerald', optionName: 'Emerald gown' },
    )).toBe('One-size gown — Emerald · Emerald · Emerald gown');
    expect(lineSizeLabel(
      { sizeName: 'Portable speaker — Sand speaker' },
      { displayName: 'Portable speaker — Sand speaker', optionName: 'Sand speaker' },
    )).toBe('Portable speaker — Sand speaker · Sand speaker');
  });
});
