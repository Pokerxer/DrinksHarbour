// @vitest-environment jsdom
// DRI-34 — /inventory Adjustments surface (checklist item 6): the entry keys
// the exact Size id and the count-preview reflects PER-VARIANT on-hand rows —
// the Emerald and Ivory variants of one product show their own counts, never
// an aggregate; submissions carry the exact sizeId.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { warehouseStockService, type StockRow } from '@/services/warehouseStock.service';
import { warehouseService } from '@/services/warehouse.service';
import { warehouseFixture } from '@/test/warehouse-fixture';
import { inventoryAdjustmentService } from '@/services/inventoryAdjustment.service';
import AdjustmentModal from './inventory-adjustment-modal';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const stockRow = (over: Partial<StockRow>): StockRow =>
  ({
    _id: over.sizeId ?? 'line',
    warehouseId: 'city',
    warehouseName: 'City',
    subProductId: 'sp-tee',
    productName: 'Silk Tee',
    sku: 'TEE',
    sizeId: 'sz-x',
    sizeName: 'M',
    currentQuantity: 0,
    reservedQuantity: 0,
    costPrice: 500,
    ...over,
  }) as StockRow;

const load = () => {
  vi.spyOn(warehouseService, 'getWarehouses').mockResolvedValue({
    success: true,
    data: [warehouseFixture({ _id: 'city', name: 'City', isActive: true })],
  });
  vi.spyOn(warehouseStockService, 'getAllStock').mockResolvedValue({
    success: true,
    data: [
      stockRow({ _id: 'l-em', sizeId: 'sz-em', sizeName: 'M', colorName: 'Emerald', colorHexCode: '#0f5132', currentQuantity: 10 }),
      stockRow({ _id: 'l-iv', sizeId: 'sz-iv', sizeName: 'M', colorName: 'Ivory', currentQuantity: 30 }),
      // A portion-flavour row for the food-service surface.
      stockRow({ _id: 'l-jol', sizeId: 'sz-reg', sizeName: 'Regular plate', optionName: 'Jollof portion', currentQuantity: 7 }),
      // Colourless beverage sizes keyed by their own exact Size ids.
      stockRow({ _id: 'l-750', sizeId: 'sz-750', sizeName: '750ml', currentQuantity: 24 }),
      stockRow({ _id: 'l-case', sizeId: 'sz-case', sizeName: 'Case of 6 (4500)', currentQuantity: 4 }),
    ],
  });
};

it('variant options are distinct and count-preview reflects the per-variant row, not an aggregate', async () => {
  load();
  render(<AdjustmentModal token="t" close={vi.fn()} done={vi.fn()} />);
  await waitFor(() =>
    expect(screen.getByRole('option', { name: 'Silk Tee · TEE' })).toBeTruthy(),
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Product' }), {
    target: { value: 'sp-tee' },
  });
  const sizes = screen.getByRole('combobox', { name: /Size/i }) as HTMLSelectElement;
  const optionLabels = Array.from(sizes.options).map((o) => o.textContent);
  expect(optionLabels).toContain('M · Emerald');
  expect(optionLabels).toContain('M · Ivory');
  // Exact sizeId keys inside the select element.
  const values = new Map(
    Array.from(sizes.options).map((o) => [o.textContent, o.value]),
  );
  expect(values.get('M · Emerald')).toBe('sz-em');
  expect(values.get('M · Ivory')).toBe('sz-iv');

  fireEvent.change(sizes, { target: { value: 'sz-em' } });
  expect(screen.getByText(/On hand:/).textContent).toContain('10');
  fireEvent.change(sizes, { target: { value: 'sz-iv' } });
  expect(screen.getByText(/On hand:/).textContent).toContain('30');
  // NOT the aggregate 40 (variants are separate count sheets).
  expect(screen.getByText(/On hand:/).textContent).not.toContain('40');

  // Per-variant after-count preview posts per selected Size row.
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Counted quantity' }), {
    target: { value: '4' },
  });
  expect(screen.getByText(/After adjustment:/).textContent).toContain('4');
});

it('saves against the exact selected Size id', async () => {
  load();
  const save = vi
    .spyOn(inventoryAdjustmentService, 'create')
    .mockResolvedValue({ success: true });
  render(<AdjustmentModal token="t" close={vi.fn()} done={vi.fn()} />);
  await waitFor(() =>
    expect(screen.getByRole('option', { name: 'Silk Tee · TEE' })).toBeTruthy(),
  );
  fireEvent.change(screen.getByRole('combobox', { name: 'Product' }), {
    target: { value: 'sp-tee' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: /Size/i }), {
    target: { value: 'sz-em' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Counted quantity' }), {
    target: { value: '4' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
    target: { value: 'Variant count' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save adjustment' }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(save.mock.calls[0][1].sizeId).toBe('sz-em');
});
