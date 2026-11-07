// @vitest-environment jsdom
// DRI-34 — customer returns browser surfaces (checklist item 4, client side).
// Synthetic rows span every flavour (board evidence matrix): beverage volume/
// pack colourless, food-service portion options (Jollof vs Goat), Fashion
// colour variants (Emerald vs Ivory), option-only electronics/home rows and an
// identity-less legacy control. The PRINT document builder keeps stored
// snapshot bytes (recorded decision 2) — asserted to never contain composed
// identity.

import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { CustomerReturn } from '@/services/customerReturns.service';
import CustomerReturnList from './customer-return-list';
import CustomerReturnDetail from './customer-return-detail';
import { buildCustomerReturn } from '@/utils/print/customer-return';
import {
  customerReturnSizeLabel,
  restockTargetLabel,
} from './customer-return-identity';

const issuer = { name: 'Central Cellar' };

const base = (
  id: string,
  product: string,
  size: string,
  extra: Partial<CustomerReturn> = {},
): CustomerReturn =>
  ({
    id,
    source: 'pos',
    sourceId: `order-${id}`,
    sourceNumber: `R-${id}`,
    product,
    size,
    returned: 3,
    restocked: 2,
    notRestocked: 1,
    stockEvidence: 'verified',
    warehouse: { _id: 'w1', name: 'City store' },
    date: '2026-11-05T10:00:00Z',
    ...extra,
  }) as CustomerReturn;

const rows: CustomerReturn[] = [
  base('b1', 'Sancerre', '750ml'),
  base('b2', 'House Vino Carton', 'Case of 6 (4500)'),
  base('f1', 'Jollof plate', 'Regular plate', { optionName: 'Jollof portion' }),
  base('f2', 'Jollof plate', 'Regular plate', { optionName: 'Goat portion' }),
  base('fa1', 'Silk Tee', 'M', { colorName: 'Emerald', colorHexCode: '#0f5132' }),
  base('fa2', 'Silk Tee', 'M', { colorName: 'Ivory', colorHexCode: '#f2f2ea' }),
  base('e1', 'Cabinet Speaker', 'Standard', { optionName: 'With Wi-Fi' }),
  base('h1', 'Oak Shelf', 'Wall unit', { optionName: 'With drawers' }),
  base('lg', 'Grimbergen', '75cl'),
];

afterEach(cleanup);

it('list composes the shared variant label per flavour; variants do not merge; legacy stays byte-identical', () => {
  render(<CustomerReturnList rows={rows} onSelect={() => {}} />);
  // Beverages: colourless volume/pack rows keep the exact stored size bytes.
  expect(screen.getByText('750ml')).toBeTruthy();
  expect(screen.getByText('Case of 6 (4500)')).toBeTruthy();
  // Food-service: same size, option identity keeps siblings apart.
  expect(screen.getByText('Regular plate · Jollof portion')).toBeTruthy();
  expect(screen.getByText('Regular plate · Goat portion')).toBeTruthy();
  // Fashion: same size, colour variants do not merge.
  expect(screen.getByText('M · Emerald')).toBeTruthy();
  expect(screen.getByText('M · Ivory')).toBeTruthy();
  // Option-only electronics/home rows.
  expect(screen.getByText('Standard · With Wi-Fi')).toBeTruthy();
  expect(screen.getByText('Wall unit · With drawers')).toBeTruthy();
  // Legacy control: exact pre-change bytes.
  expect(screen.getByText('75cl')).toBeTruthy();
});

it('detail composes the shared label and surfaces the restock target only when exposed', () => {
  render(
    <CustomerReturnDetail
      row={rows[4] /* Silk Tee M · Emerald */}
      onClose={() => {}}
      onPrint={() => {}}
    />,
  );
  expect(
    screen.getByText((content, el) => el?.tagName === 'SPAN' && content === '· M · Emerald'),
  ).toBeTruthy();
  // No restock target in today's payload → no placeholder is invented.
  expect(screen.queryByText(/Restock targets size/)).toBeNull();
  cleanup();
  render(
    <CustomerReturnDetail
      row={{ ...rows[4], restockSizeId: 'size-emerald', restockSizeName: 'M · Emerald' }}
      onClose={() => {}}
      onPrint={() => {}}
    />,
  );
  const restock = screen.getByText((content, el) =>
    el?.tagName === 'P' && el.textContent === 'Restock targets size M · Emerald',
  );
  expect(restock).toBeTruthy();
});

it('restockTargetLabel resolves to null without inventing placeholders for legacy rows', () => {
  expect(restockTargetLabel(rows[8])).toBeNull();
  const targeted = { ...rows[8], restockSizeId: 'sz', restockSizeName: '75cl' };
  expect(restockTargetLabel(targeted)).toBe('75cl');
});

it('print builder keeps stored row.size snapshot bytes — composed identity never leaks in', () => {
  const model = buildCustomerReturn(rows, issuer, 'All warehouses');
  const text = JSON.stringify(model);
  expect(text).toContain('750ml');
  expect(text).toContain('Case of 6 (4500)');
  expect(text).toContain('Regular plate');
  expect(text).toContain('75cl');
  // The legacy control's exact chain stays; composed identity must be absent
  // from the document entirely.
  expect(text).not.toContain('Emerald');
  expect(text).not.toContain('Ivory');
  expect(text).not.toContain('Jollof portion');
  expect(text).not.toContain('Goat portion');
  expect(text).not.toContain('With Wi-Fi');
  expect(text).not.toContain('With drawers');
});

it('customerReturnSizeLabel is the shared composer with the stored-size fallback chain', () => {
  expect(customerReturnSizeLabel(rows[0])).toBe('750ml');
  expect(customerReturnSizeLabel(rows[2])).toBe('Regular plate · Jollof portion');
  expect(customerReturnSizeLabel(rows[4])).toBe('M · Emerald');
  expect(customerReturnSizeLabel(rows[8])).toBe('75cl');
});

it('mobile card composes the same label inline with source metadata', () => {
  render(<CustomerReturnList rows={[rows[4], rows[5]]} onSelect={() => {}} />);
  const emerald = screen
    .getAllByRole('article')
    .find((a) => a.textContent?.includes('R-fa1'))!;
  expect(within(emerald).getByText('M · Emerald · POS · R-fa1')).toBeTruthy();
  const ivory = screen
    .getAllByRole('article')
    .find((a) => a.textContent?.includes('R-fa2'))!;
  expect(within(ivory).getByText('M · Ivory · POS · R-fa2')).toBeTruthy();
});
