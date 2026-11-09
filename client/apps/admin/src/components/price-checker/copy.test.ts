import { describe, expect, it } from 'vitest';
import { LANGUAGES, keysOf, t, type Language } from './copy';

describe('copy dictionary', () => {
  it('exposes the three languages', () => {
    expect(LANGUAGES.map((row) => row.id)).toEqual(['en', 'ha', 'pig']);
  });
  it('every language carries the same keys as english', () => {
    for (const { id } of LANGUAGES) {
      const langKeys = keysOf(id).sort();
      expect(langKeys).toEqual(keysOf('en').sort());
      expect(langKeys.length).toBeGreaterThan(40);
    }
  });
  it('interpolates {name-style} variables', () => {
    expect(t('en', 'footerCountdown', { n: 7 })).toContain('7');
    expect(t('pig', 'footerCountdown', { n: 7 })).toContain('7');
  });
  it('falls back to english for a missing key', () => {
    expect(t('ha', 'definitelyMissing' as keyof never)).toBe('definitelyMissing');
  });
  it('keeps unknown variables literal-empty rather than crashing', () => {
    expect(t('en', 'footerCountdown', {})).not.toContain('undefined');
  });
});
