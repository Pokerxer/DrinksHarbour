import { expect, it } from 'vitest';
import { noticeAppearance, noticeFacts } from './notice-presentation';
it('gives alerts readable names and distinct visual cues, including unknown types', () => {
  expect(noticeAppearance('low_stock_alert').label).toBe('Stock alert');
  expect(noticeAppearance('product_performance').label).toBe('Selling well');
  expect(noticeAppearance('product_suggestion').label).toBe('Suggestion');
  expect(noticeAppearance('unknown').label).toBe('General update');
  expect(noticeAppearance('product_performance').tile).not.toBe(
    noticeAppearance('low_stock_alert').tile
  );
});
it('renders complete stock and sales evidence with units while skipping invalid and private fields', () => {
  const facts = noticeFacts({
    productName: 'Wine',
    currentUnits: 5,
    previousUnits: 2,
    units30: 12,
    suggestedUnits: 1,
    threshold: 10,
    quantity: 3,
    rule: 'private-rule',
    expiryDate: 'bad',
    periodStart: 'bad',
    periodEnd: 'bad',
  });
  expect(facts).toContainEqual({
    label: 'Units sold (current period)',
    value: '5 units',
  });
  expect(facts).toContainEqual({
    label: 'Units sold (30 days)',
    value: '12 units',
  });
  expect(facts).toContainEqual({ label: 'Previous period', value: '2 units' });
  expect(facts).toContainEqual({
    label: 'Suggested quantity',
    value: '1 unit',
  });
  expect(
    facts.some((f) => f.value === 'private-rule' || f.value.includes('Invalid'))
  ).toBe(false);
  expect(
    noticeFacts({
      quantity: NaN,
      warehouseName: '',
      periodStart: '2026-10-08',
      periodEnd: '2026-10-01',
    })
  ).toEqual([]);
});
it('handles exclusive sales-period ends and missing evidence', () => {
  const facts = noticeFacts({
    periodStart: '2026-10-01T00:00:00+01:00',
    periodEnd: '2026-10-08T00:00:00+01:00',
  });
  expect(facts[0].value).toContain('7 Oct 2026');
  expect(noticeFacts({})).toEqual([]);
});
