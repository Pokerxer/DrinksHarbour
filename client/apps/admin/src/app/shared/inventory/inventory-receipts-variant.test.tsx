// @vitest-environment jsdom
// DRI-34 — /inventory receipts surface (checklist item 2): the browser view
// composes the shared variant label per movement (sizeLabel — populated Size
// identity via DRI-29 fields) and a partial receipt of ONE variant leaves the
// sibling variant's balances untouched (per-variant rows, exact Size ids).

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { inventoryService, type InventoryMovement } from '@/services/inventory.service';
import InventoryReceipts from './inventory-receipts';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 't' } }, status: 'authenticated' }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const receipt = (
  id: string,
  size: unknown,
  extra: Partial<InventoryMovement> = {},
): InventoryMovement =>
  ({
    _id: id,
    subProduct: { _id: 'sp-tee', name: 'Silk Tee', sku: 'SKU-TEE' },
    size,
    warehouse: { _id: 'city', name: 'City' },
    type: 'received',
    category: 'in',
    quantity: 6,
    quantityBefore: 10,
    quantityAfter: 16,
    status: 'confirmed',
    unitCost: 500,
    totalCost: 3000,
    createdAt: '2026-11-05T09:00:00Z',
    source: 'system',
    ...extra,
  }) as InventoryMovement;

it('sizeLabel composes populated retail identity across flavours on the receipts view', async () => {
  const rows = [
    // Fashion Emerald/Ivory — exact Size ids, full identity populate.
    receipt('r-em', { _id: 'sz-em', displayName: 'M', size: 'M', colorName: 'Emerald', colorHexCode: '#0f5132' }, {
      quantityBefore: 10,
      quantityAfter: 16,
    }),
    receipt('r-iv', { _id: 'sz-iv', displayName: 'M', size: 'M', colorName: 'Ivory' }, {
      quantityBefore: 20,
      quantityAfter: 20,
    }),
    // Food-service portion identity.
    receipt('r-jol', { _id: 'sz-reg', displayName: 'Regular plate', size: 'Regular plate', optionName: 'Jollof portion' }),
    // Option-only electronics row.
    receipt('r-wifi', { _id: 'sz-wifi', displayName: 'Standard', size: 'Standard', optionName: 'With Wi-Fi' }),
    // Beverage colourless volume/pack sizes and the legacy fallback chain.
    receipt('r-vol', { _id: 'sz-750', displayName: '750ml', size: '750ml' }),
    receipt('r-leg', { _id: 'sz-75', displayName: '75cl', size: '75cl' }),
    receipt('r-bare', { _id: 'sz-raw', size: 'Case of 6 (4500)' }),
  ];
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: rows.length,
    truncated: false,
  });
  render(<InventoryReceipts />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(rows.length),
  );
  expect(screen.getByText('M · Emerald')).toBeTruthy();
  expect(screen.getByText('M · Ivory')).toBeTruthy();
  expect(screen.getByText('Regular plate · Jollof portion')).toBeTruthy();
  expect(screen.getByText('Standard · With Wi-Fi')).toBeTruthy();
  expect(screen.getByText('750ml')).toBeTruthy();
  expect(screen.getByText('75cl')).toBeTruthy();
  expect(screen.getByText('Case of 6 (4500)')).toBeTruthy();
});

it('partial receipt of one variant posts its own balances and leaves the sibling untouched', async () => {
  const rows = [
    // The partial receipt line: 6 of 12 for the Emerald Size only.
    receipt('r-em', { _id: 'sz-em', displayName: 'M', size: 'M', colorName: 'Emerald', colorHexCode: '#0f5132' }, {
      quantity: 6,
      quantityBefore: 10,
      quantityAfter: 16,
      relatedPurchaseOrder: 'po1',
      referenceType: 'purchase_order',
    }),
    // The Ivory sibling's own (older) receipt row — unchanged by Emerald's receipt.
    receipt('r-iv', { _id: 'sz-iv', displayName: 'M', size: 'M', colorName: 'Ivory' }, {
      quantity: 5,
      quantityBefore: 15,
      quantityAfter: 20,
    }),
  ];
  vi.spyOn(inventoryService, 'getAllMovements').mockResolvedValue({
    movements: rows,
    total: rows.length,
    truncated: false,
  });
  render(<InventoryReceipts />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Select line' })).toHaveLength(2),
  );
  // Each variant row renders its OWN before/after balance pair.
  expect(screen.getByText('10 → 16')).toBeTruthy();
  expect(screen.getByText('15 → 20')).toBeTruthy();
  // No merged variant row exists: exactly one Emerald cell and one Ivory cell.
  expect(screen.getAllByText('M · Emerald')).toHaveLength(1);
  expect(screen.getAllByText('M · Ivory')).toHaveLength(1);
});
