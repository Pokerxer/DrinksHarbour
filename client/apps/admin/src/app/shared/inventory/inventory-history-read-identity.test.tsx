// @vitest-environment jsdom
// DRI-36 — read surface (14) Moves History, browser-view evidence (board
// scope extension #10). No UI change is expected: the panel composes
// line-scope labels via `flatRowSizeLabel(row) || row.sizeName` and move rows
// via `sizeLabel(move)` (`populatedSizeIdentity` + shared compose), so every
// move row shows the composed variant identity and legacy rows stay
// byte-identical. Rows follow the DRI-34 flavour matrix.

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import type { StockRow } from '@/services/warehouseStock.service';
import StockHistoryPanel from './inventory-stock-history-panel';
import { buildStockHistoryDocument } from './inventory-stock-history';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const retailRow = {
  _id: 'r1',
  subProductId: 'sp-x',
  productName: 'Silk Tee',
  sku: 'SKU-T',
  warehouseId: 'w1',
  warehouseName: 'Wyn City',
  sizeId: 'sz-em',
  sizeName: 'M',
  colorName: 'Emerald',
  currentQuantity: 3,
  reservedQuantity: 0,
  costPrice: 500,
  minStockLevel: 0,
  earliestExpiry: null,
} as StockRow;

const move = (over: Partial<InventoryMovement>): InventoryMovement =>
  ({
    _id: 'm-' + Math.random().toString(36).slice(2, 8),
    subProduct: 'sp-x',
    warehouse: { _id: 'w1', name: 'Wyn City' },
    type: 'received',
    category: 'in',
    status: 'confirmed',
    quantity: 1,
    quantityBefore: 0,
    quantityAfter: 1,
    createdAt: '2026-11-05T10:00:00Z',
    ...over,
  }) as InventoryMovement;

// Every sibling variant of the same product is served by the one
// subProduct-scoped history feed (getAllMovements by subProductId) — the
// panel must filter and label per exact Size ref. The DRI-29 populate lands
// colour/option verbatim on the Size ref at runtime; the shared service type
// is narrower, so the wire shape is widened here locally (test fixture only —
// no shared source edits in this slice).
type PopulatedSize = {
  _id: string;
  displayName?: string;
  size?: string;
  colorName?: string;
  optionName?: string;
};
const populatedSize = (identity: PopulatedSize): InventoryMovement['size'] =>
  identity as unknown as InventoryMovement['size'];

// Every sibling variant of the same product is served by the one
// subProduct-scoped history feed (getAllMovements by subProductId) — the
// panel must filter and label per exact Size ref.
const retailMoves: InventoryMovement[] = [
  // Fashion Emerald: populated Size ref carrying colour identity (DRI-29).
  move({
    _id: 'm-em',
    size: populatedSize({ _id: 'sz-em', size: 'M', displayName: 'M', colorName: 'Emerald' }),
    quantity: 5,
    quantityBefore: 0,
    quantityAfter: 5,
  }),
  // Fashion Ivory sibling: same sizeName, own exact Size.
  move({
    _id: 'm-iv',
    size: populatedSize({ _id: 'sz-iv', size: 'M', displayName: 'M', colorName: 'Ivory' }),
    type: 'sold',
    category: 'out',
    quantity: 2,
    quantityBefore: 3,
    quantityAfter: 1,
  }),
  // Food-service portion siblings: option-only identity.
  move({
    _id: 'm-j1',
    size: populatedSize({ _id: 'sz-j1', displayName: 'Regular plate', optionName: 'Jollof portion' }),
    quantity: 3,
  }),
  move({
    _id: 'm-j2',
    size: populatedSize({ _id: 'sz-j2', displayName: 'Regular plate', optionName: 'Goat portion' }),
    type: 'sold',
    category: 'out',
    quantity: 1,
    quantityBefore: 4,
    quantityAfter: 3,
  }),
  // Colourless beverage volume/pack Size refs (no colour/option).
  move({
    _id: 'm-750',
    size: populatedSize({ _id: 'sz-750', size: '750ml' }),
    quantity: 4,
  }),
  move({
    _id: 'm-case',
    size: populatedSize({ _id: 'sz-case', size: 'Case of 6 (4500)' }),
    quantity: 1,
  }),
  // Identity-less legacy move: no populated Size ref and no warehouse.
  move({
    _id: 'm-legacy',
    warehouse: null,
    size: null,
    reference: 'PO-LEGACY',
    quantity: 2,
  }),
];

const setup = (moves: InventoryMovement[]) =>
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: moves,
    total: moves.length,
    truncated: false,
  });

it('line scope keeps the exact Size: the Ivory sibling move is excluded and the Emerald move row shows its composed identity', async () => {
  setup(retailMoves);
  render(<StockHistoryPanel row={retailRow} token="token" />);
  await waitFor(() => expect(screen.getByText('Wyn City · M · Emerald')).toBeTruthy());
  expect(screen.getByText('1 entries · newest first')).toBeTruthy();
  // The exact-Size move row carries the full composed variant identity.
  // The same-size Ivory sibling is NOT part of this Size's history.
  expect(screen.queryByText('M · Ivory')).toBeNull();
  // The scope description composes the full row identity.
  expect(screen.getByText(/M · Emerald\. Older entries/)).toBeTruthy();
});

it('all-product scope shows each sibling variant as its own identity-labelled move row', async () => {
  setup(retailMoves);
  render(<StockHistoryPanel row={retailRow} token="token" />);
  await waitFor(() => expect(screen.getByText('Wyn City · M · Emerald')).toBeTruthy());
  fireEvent.change(screen.getByLabelText('History scope'), {
    target: { value: 'product' },
  });
  await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(7));
  // No move row ever merges two variant identities: each sibling shows the
  // composed label of its own exact Size.
  expect(screen.getByText('Wyn City · M · Emerald')).toBeTruthy();
  expect(screen.getByText('Wyn City · M · Ivory')).toBeTruthy();
  expect(screen.getByText('Wyn City · Regular plate · Jollof portion')).toBeTruthy();
  expect(screen.getByText('Wyn City · Regular plate · Goat portion')).toBeTruthy();
  expect(screen.getByText('Wyn City · 750ml')).toBeTruthy();
  expect(screen.getByText('Wyn City · Case of 6 (4500)')).toBeTruthy();
  // The identity-less legacy move (no warehouse, no size) falls back to the
  // exact pre-change bytes.
  expect(screen.getByText(/No size recorded/)).toBeTruthy();
});

it("the pack matrix on one beverage row: '750ml' move stays while the pack sibling is excluded in line scope", async () => {
  setup(retailMoves);
  const beverageRow = {
    ...retailRow,
    _id: 'r3',
    sizeId: 'sz-750',
    sizeName: '750ml',
    colorName: null,
  } as StockRow;
  render(<StockHistoryPanel row={beverageRow} token="token" />);
  await waitFor(() => expect(screen.getByText('Wyn City · 750ml')).toBeTruthy());
  expect(screen.queryByText('Case of 6 (4500)')).toBeNull();
});

it('legacy rows keep exact byte identity in the scope line and the print document', async () => {
  setup(retailMoves);
  const legacyRow = {
    ...retailRow,
    _id: 'r4',
    sizeId: 'sz-legacy',
    sizeName: '75cl',
    colorName: null,
  } as StockRow;
  render(<StockHistoryPanel row={legacyRow} token="token" />);
  // No move carries sz-legacy, so line scope is empty for the legacy control —
  // the raw empty-state bytes render.
  await waitFor(() =>
    expect(screen.getByText('No movements recorded for this view.')).toBeTruthy(),
  );
  expect(screen.getByText(/75cl\. Older entries/)).toBeTruthy();

  // Print document: the line-scope meta composes over the legacy fallback and
  // resolves to exactly the stored sizeName bytes; move rows carry the
  // per-variant identities without merging siblings.
  const legacyDoc = buildStockHistoryDocument(legacyRow, retailMoves, 'line');
  expect(legacyDoc.meta).toContainEqual(['Scope', 'Wyn City · 75cl']);
  const subs = legacyDoc.table.rows.map((cells) => cells[2].sub ?? '');
  expect(subs).toContain('M · Emerald');
  expect(subs).toContain('M · Ivory');
  expect(subs).toContain('Regular plate · Jollof portion');
  expect(subs).toContain('Regular plate · Goat portion');
  expect(subs).toContain('750ml');
  expect(subs).toContain('Case of 6 (4500)');
  expect(subs).toContain('No size recorded');

  // The retail row's document composes the full identity in the scope meta.
  const retailDoc = buildStockHistoryDocument(retailRow, retailMoves, 'line');
  expect(retailDoc.meta).toContainEqual(['Scope', 'Wyn City · M · Emerald']);
});
