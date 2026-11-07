// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { StockRow } from '@/services/warehouseStock.service';
import { StockDrillDrawer, StockRowColorDot } from './stock-drill-drawer';

// DRI-17: drill rows must stay DISTINCT per variant (exact Size IDs upstream),
// present the shared full identity label, and only colour rows carry a dot.
// The legacy beverage control row (colourless) renders byte-identically to the
// pre-variant surface — bare full-size string, no dot.

let seq = 0;
const row = (over: Partial<StockRow> = {}): StockRow =>
  ({
    _id: `r${++seq}`,
    warehouseId: 'wh1',
    warehouseName: 'Main Shop',
    subProductId: 'sp1',
    productName: 'Harper Tee',
    sku: 'HT-1',
    sizeId: 'sz1',
    sizeName: 'm',
    currentQuantity: 5,
    reservedQuantity: 0,
    costPrice: 500,
    minStockLevel: 2,
    earliestExpiry: null,
    ...over,
  }) as StockRow;

afterEach(cleanup);

describe('StockDrillDrawer size presentation (DRI-17)', () => {
  const rows = [
    row({
      _id: 'e',
      sizeId: 'sz-emerald',
      sizeName: 'm',
      colorName: 'Emerald',
      colorHexCode: '#9fd6a2',
    }),
    row({
      _id: 'i',
      sizeId: 'sz-ivory',
      sizeName: 'm',
      colorName: 'Ivory',
      colorHexCode: '#f8f4e9',
    }),
    row({ _id: 'l', sizeId: 'sz-70cl', sizeName: '70cl', productName: 'Jack Daniels' }),
  ];

  it('renders each variant row distinct with full identity labels and colour dots', () => {
    const { container } = render(
      <StockDrillDrawer rows={rows} title="Bucket" onClose={() => {}} />,
    );
    expect(screen.getByText('m · Emerald')).toBeTruthy();
    expect(screen.getByText('m · Ivory')).toBeTruthy();
    // One discrete dot per colour row, with the colour name as its title.
    expect(container.querySelectorAll('span[title="Emerald"]')).toHaveLength(1);
    expect(container.querySelectorAll('span[title="Ivory"]')).toHaveLength(1);
  });

  it('legacy beverage rows render the stored size-name byte-identically with no dot', () => {
    const { container } = render(
      <StockDrillDrawer rows={[rows[2]]} title="Bucket" onClose={() => {}}
      />,
    );
    expect(screen.getByText('70cl')).toBeTruthy();
    expect(container.querySelectorAll('span[title]')).toHaveLength(0);
  });

  it('size sort orders by the full identity label, legacy row distinct', () => {
    render(<StockDrillDrawer rows={rows} title="Bucket" onClose={() => {}} />);
    const header = screen.getByText('Size');
    fireEvent.click(header); // desc
    fireEvent.click(header); // asc
    const sizeCells = screen
      .getAllByText('Main Shop')
      .map((c) => c.closest('tr')!.cells[2].textContent);
    expect(sizeCells).toEqual(['70cl', 'm · Emerald', 'm · Ivory']);
  });
});

describe('StockRowColorDot', () => {
  it('renders only for valid hex swatches and titles the colour name', () => {
    const { container } = render(
      <StockRowColorDot row={row({ colorName: 'Amber', colorHexCode: '#ffcc00' })} />,
    );
    expect(container.querySelector('span[title="Amber"]')).toBeTruthy();

    const { container: bad } = render(
      <StockRowColorDot row={row({ colorName: 'Amber', colorHexCode: 'amber' })} />,
    );
    expect(bad.innerHTML).toBe('');

    const { container: none } = render(<StockRowColorDot row={row()} />);
    expect(none.innerHTML).toBe('');
  });
});
