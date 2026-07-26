import { describe, it, expect } from 'vitest';
import { buildDashboardQuery, PERIOD_KEYS } from './dashboard.service';

describe('buildDashboardQuery', () => {
  it('returns an empty string when no params are given', () => {
    expect(buildDashboardQuery({})).toBe('');
    expect(buildDashboardQuery({ period: undefined })).toBe('');
  });

  it('serialises a simple period key', () => {
    expect(buildDashboardQuery({ period: '30d' })).toBe('?period=30d');
  });

  it('drops an unrecognised period rather than forwarding it', () => {
    expect(buildDashboardQuery({ period: 'nonsense' })).toBe('');
  });

  it('includes from/to only for the custom period', () => {
    expect(buildDashboardQuery({ period: 'custom', from: '2026-03-01', to: '2026-03-10' }))
      .toBe('?period=custom&from=2026-03-01&to=2026-03-10');
    // from/to are meaningless without period=custom and must not be forwarded
    expect(buildDashboardQuery({ period: '7d', from: '2026-03-01', to: '2026-03-10' }))
      .toBe('?period=7d');
  });

  it('drops custom when from or to is missing', () => {
    expect(buildDashboardQuery({ period: 'custom', from: '2026-03-01' })).toBe('');
    expect(buildDashboardQuery({ period: 'custom' })).toBe('');
  });

  it('exposes the same seven keys the server accepts', () => {
    expect(PERIOD_KEYS).toEqual(['today', '7d', '30d', 'month', 'quarter', 'year', 'custom']);
  });
});
