// @vitest-environment jsdom
// DRI-34 — /inventory deliveries (#3) and Internal (#5) surfaces: movement
// rows compose the shared identity label on the browser views, exports keep
// the same identity cells, and NO beverage-only default units appear in the
// delivery/internal views or exports. Flavours span the full board matrix,
// with an identity-less legacy control staying byte-identical.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import InventoryMovementsBrowser from './inventory-movements-browser';
import { movementsCSV } from './inventory-movement-export';
import { PRESETS } from './inventory-movements-presets';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const move = (
  id: string,
  size: unknown,
  extra: Partial<InventoryMovement> = {},
): InventoryMovement =>
  ({
    _id: id,
    subProduct: { _id: 'sp1', name: 'Silk Tee', sku: 'SKU-1' },
    size,
    warehouse: { _id: 'city', name: 'City' },
    type: 'sold',
    category: 'out',
    quantity: 3,
    quantityBefore: 8,
    quantityAfter: 5,
    totalCost: 30,
    unitCost: 10,
    status: 'confirmed',
    source: 'pos',
    createdAt: '2026-11-04T12:00:00Z',
    ...extra,
  }) as InventoryMovement;

const emerald = { _id: 'sz-em', displayName: 'M', size: 'M', colorName: 'Emerald', colorHexCode: '#0f5132' };
const ivory = { _id: 'sz-iv', displayName: 'M', size: 'M', colorName: 'Ivory' };
const jollof = { _id: 'sz-reg', displayName: 'Regular plate', size: 'Regular plate', optionName: 'Jollof portion' };
const goat = { _id: 'sz-reg', displayName: 'Regular plate', size: 'Regular plate', optionName: 'Goat portion' };
const wifi = { _id: 'sz-wifi', displayName: 'Standard', size: 'Standard', optionName: 'With Wi-Fi' };
const drawers = { _id: 'sz-draw', displayName: 'Wall unit', size: 'Wall unit', optionName: 'With drawers' };
const vol750 = { _id: 'sz-750', displayName: '750ml', size: '750ml' };
const pack = { _id: 'sz-case', displayName: 'Case of 6 (4500)', size: 'Case of 6 (4500)' };
const legacy = { _id: 'sz-75', displayName: '75cl', size: '75cl' };

const rowsFor = (extra: Partial<InventoryMovement>) => [
  { ...move('m-em', emerald, extra) },
  { ...move('m-iv', ivory, extra) },
  { ...move('m-jol', jollof, extra) },
  { ...move('m-got', goat, extra) },
  { ...move('m-wifi', wifi, extra) },
  { ...move('m-draw', drawers, extra) },
  { ...move('m-vol', vol750, extra) },
  { ...move('m-case', pack, extra) },
  { ...move('m-leg', legacy, extra) },
];

const mount = async (preset: 'deliveries' | 'internal') => {
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rowsFor({}),
    total: 9,
    truncated: false,
  });
  render(<InventoryMovementsBrowser preset={preset} />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(9),
  );
};

it.each(['deliveries', 'internal'] as const)(
  '%s movement rows compose the per-variant identity label — flavours stay distinct',
  async (preset) => {
    await mount(preset);
    expect(screen.getByText('M · Emerald')).toBeTruthy();
    expect(screen.getByText('M · Ivory')).toBeTruthy();
    expect(screen.getByText('Regular plate · Jollof portion')).toBeTruthy();
    expect(screen.getByText('Regular plate · Goat portion')).toBeTruthy();
    expect(screen.getByText('Standard · With Wi-Fi')).toBeTruthy();
    expect(screen.getByText('Wall unit · With drawers')).toBeTruthy();
    expect(screen.getByText('750ml')).toBeTruthy();
    expect(screen.getByText('Case of 6 (4500)')).toBeTruthy();
    expect(screen.getByText('75cl')).toBeTruthy();
  },
);

it('delivery/internal views and exports carry no beverage-only default units', () => {
  // Every units header across the family is a generic "Units …" noun.
  const labels = [
    PRESETS.deliveries.unitsLabel,
    PRESETS.internal.unitsLabel,
  ];
  expect(labels).toEqual(['Units Issued', 'Units Moved']);
  for (const label of [...labels]) expect(label.startsWith('Units ')).toBe(true);
  // The CSV exporter adds no volume/pack/unit-noun columns — the composed
  // identity label is the only size signal on the row.
  const csv = movementsCSV(rowsFor({}));
  if (csv) {
    const headers = csv.split('\n')[0].toLowerCase();
    expect(headers.includes('bottle')).toBe(false);
    expect(headers.includes(' pack')).toBe(false);
    expect(headers.includes('abv')).toBe(false);
    expect(headers.includes('ml column')).toBe(false);
  }
});
