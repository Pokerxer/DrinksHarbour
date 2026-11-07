import { describe, expect, it } from 'vitest';
import {
  SOURCING_COUNTRIES,
  SOURCING_COUNTRY_NAMES,
  getSourceCountryFlag,
} from './countries';

describe('origin country sourcing dictionary', () => {
  it('covers the curated sourcing list with unique names and flags', () => {
    expect(SOURCING_COUNTRIES).toHaveLength(64);
    expect(new Set(SOURCING_COUNTRY_NAMES).size).toBe(SOURCING_COUNTRIES.length);
    for (const country of SOURCING_COUNTRIES) {
      expect(country.name.trim().length).toBeGreaterThan(0);
      expect(country.flag.length).toBeGreaterThan(0);
    }
  });

  it('preserves the local market and the legacy regional keys', () => {
    for (const name of [
      'Nigeria',
      'Ghana',
      'Kenya',
      'South Africa',
      'United Kingdom',
      'England',
      'Scotland',
      'Wales',
      'UAE',
      'United States',
      'Australia',
      'New Zealand',
    ]) {
      expect(SOURCING_COUNTRY_NAMES).toContain(name);
    }
  });

  it('resolves flags by name with the legacy alias fallback', () => {
    expect(getSourceCountryFlag('Nigeria')).toBe('🇳🇬');
    expect(getSourceCountryFlag('United States')).toBe('🇺🇸');
    // Legacy alias spellings keep resolving after the dictionary swap.
    expect(getSourceCountryFlag('usa')).toBe('🇺🇸');
    expect(getSourceCountryFlag('new_zealand')).toBe('🇳🇿');
    expect(getSourceCountryFlag('Mars')).toBe('🌍');
  });
});
