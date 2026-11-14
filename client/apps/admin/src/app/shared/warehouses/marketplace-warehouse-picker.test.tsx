// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { warehouseFixture } from '@/test/warehouse-fixture';
import MarketplaceWarehousePicker from './marketplace-warehouse-picker';

afterEach(cleanup);

it('keeps multiple warehouses selected and allows each to be cleared independently', () => {
  function Settings() {
    const [selected, setSelected] = useState(['north']);
    return <MarketplaceWarehousePicker
      selected={selected}
      onChange={setSelected}
      warehouses={[
        warehouseFixture({ _id: 'north', name: 'North', code: 'N' }),
        warehouseFixture({ _id: 'south', name: 'South', code: 'S' }),
        warehouseFixture({ _id: 'closed', name: 'Closed', isActive: false }),
      ]}
    />;
  }

  render(<Settings />);
  const north = screen.getByRole<HTMLInputElement>('checkbox', { name: 'North (N)' });
  const south = screen.getByRole<HTMLInputElement>('checkbox', { name: 'South (S)' });
  fireEvent.click(south);
  expect(north.checked).toBe(true);
  expect(south.checked).toBe(true);
  fireEvent.click(north);
  expect(north.checked).toBe(false);
  expect(south.checked).toBe(true);
  expect(screen.queryByRole('checkbox', { name: /closed/i })).toBeNull();
});
