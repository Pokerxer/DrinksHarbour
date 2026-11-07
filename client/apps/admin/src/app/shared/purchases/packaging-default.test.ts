// DRI-14 — pack-noun entry-time default unit tests (see types.ts).
import { describe, it, expect } from 'vitest';
import {
  packNounOf,
  packsLabel,
  defaultPackagingForLine,
} from './types';

describe('packNounOf keeps the legacy fallback contract', () => {
  it("falls back to 'bottle' for rows lacking packaging text (byte-stable)", () => {
    expect(packNounOf(undefined)).toBe('bottle');
    expect(packNounOf('')).toBe('bottle');
  });

  it('maps beverage packaging text onto a countable noun (unchanged)', () => {
    expect(packNounOf('glass_bottle')).toBe('bottle');
    expect(packNounOf('plastic_bottle')).toBe('bottle');
    expect(packNounOf('can')).toBe('can');
    expect(packNounOf('keg')).toBe('keg');
    expect(packNounOf('carton')).toBe('carton');
  });

  it('consumes the industry-neutral entry defaults', () => {
    expect(packNounOf('units')).toBe('unit');
    expect(packNounOf('pieces')).toBe('piece');
  });
});

describe('packsLabel with a neutral noun', () => {
  it('pluralizes the industry-neutral noun like the legacy one', () => {
    expect(packsLabel(5, 1, 'unit')).toBe('5 units');
    expect(packsLabel(1, 1, 'unit')).toBe('1 unit');
    expect(packsLabel(26, 6, 'piece')).toBe('4 packs & 2 pieces');
    expect(packsLabel(24, 6, 'piece')).toBe('4 packs');
    // Legacy beverage bytes are untouched.
    expect(packsLabel(26, 6, 'bottle')).toBe('4 packs & 2 bottles');
  });
});

describe('defaultPackagingForLine (line-entry rule)', () => {
  it('gives retail variant rows an industry-neutral explicit noun', () => {
    expect(defaultPackagingForLine({ colorName: 'Emerald', unitType: 'piece' })).toBe('pieces');
    expect(defaultPackagingForLine({ optionName: 'Graphite speaker', unitType: 'count_unit' })).toBe('units');
    expect(defaultPackagingForLine({ colorName: 'Emerald' })).toBe('units');
  });

  it('never branches on industry and leaves beverage rows untouched', () => {
    // Every beverage Size row is colourless — the rule returns undefined so
    // the stored behaviour (and the 'bottle' print fallback) is preserved.
    expect(defaultPackagingForLine(undefined)).toBeUndefined();
    expect(defaultPackagingForLine({})).toBeUndefined();
    expect(defaultPackagingForLine({ colorName: '' })).toBeUndefined();
    expect(defaultPackagingForLine({ optionName: undefined, unitType: 'volume_ml' })).toBeUndefined();
  });
});
