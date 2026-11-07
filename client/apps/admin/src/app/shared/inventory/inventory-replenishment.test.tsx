// @vitest-environment jsdom
// DRI-34 — replenishment rule rows (checklist item 10, client side). getRules
// starts populating `size` (backend slice); the rule's targeted Size renders
// with the shared label when present — identity compose for colour/option
// variants, displayName for populated identity-less beverage sizes — and rules
// without a Size keep today's exact row bytes.

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { reorderService, type ReorderRule } from '@/services/reorder.service';
import InventoryReplenishment, { ruleSizeLabel } from './inventory-replenishment';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { token: 't', id: 'u1' } },
    status: 'authenticated',
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const rule = (over: Partial<ReorderRule>): ReorderRule =>
  ({
    _id: over._id ?? 'r1',
    tenant: 't1',
    subProduct: { _id: 'sp1', sku: 'SKU-1' },
    name: `Rule ${over._id ?? 'r1'}`,
    triggerType: 'reorder_point',
    minQuantity: 5,
    reorderPoint: 5,
    daysOfStock: 7,
    forecastDays: 14,
    quantityType: 'fixed',
    orderQuantity: 20,
    daysOfSupply: 10,
    leadTimeDays: 3,
    minimumOrderQuantity: 1,
    isAutomatic: false,
    autoCreatePurchaseOrder: false,
    autoApprove: false,
    notifyOnTrigger: true,
    notifyEmails: [],
    checkFrequency: 'daily',
    status: 'active',
    isActive: true,
    triggerCount: 0,
    recentTriggers: [],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    ...over,
  }) as ReorderRule;

const rules: ReorderRule[] = [
  // Legacy rule without a Size — today's exact rendering.
  rule({ _id: 'r-legacy', subProduct: { _id: 'sp-w', sku: 'SKU-W' }, product: { name: 'Sancerre 750ml' } }),
  // Food-service same-size portion rules: identity keeps them apart.
  rule({
    _id: 'r-jollof',
    product: { name: 'Jollof plate' },
    size: { _id: 'sz-reg', displayName: 'Regular plate', size: 'Regular plate', optionName: 'Jollof portion' },
  }),
  rule({
    _id: 'r-goat',
    product: { name: 'Jollof plate' },
    size: { _id: 'sz-reg', displayName: 'Regular plate', size: 'Regular plate', optionName: 'Goat portion' },
  }),
  // Fashion colour rules.
  rule({
    _id: 'r-emerald',
    product: { name: 'Silk Tee' },
    size: { _id: 'sz-em', displayName: 'M', size: 'M', colorName: 'Emerald', colorHexCode: '#0f5132' },
  }),
  rule({
    _id: 'r-ivory',
    product: { name: 'Silk Tee' },
    size: { _id: 'sz-iv', displayName: 'M', size: 'M', colorName: 'Ivory' },
  }),
  // Populated identity-less beverage volume size presents its displayName.
  rule({
    _id: 'r-vol',
    product: { name: 'Chianti' },
    size: { _id: 'sz-750', displayName: '750ml', size: '750ml' },
  }),
];

it('rule rows render the targeted Size with the shared label; variants stay distinct', async () => {
  vi.spyOn(reorderService, 'getRules').mockResolvedValue({ data: rules });
  render(<InventoryReplenishment />);
  await waitFor(() =>
    expect(screen.getAllByRole('button', { name: 'Trigger' })).toHaveLength(
      rules.length,
    ),
  );
  expect(screen.getByText('Regular plate · Jollof portion')).toBeTruthy();
  expect(screen.getByText('Regular plate · Goat portion')).toBeTruthy();
  expect(screen.getByText('M · Emerald')).toBeTruthy();
  expect(screen.getByText('M · Ivory')).toBeTruthy();
  expect(screen.getByText('750ml')).toBeTruthy();
});

it('rules without a Size keep their current row bytes', async () => {
  vi.spyOn(reorderService, 'getRules').mockResolvedValue({
    data: [rules[0]],
  });
  render(<InventoryReplenishment />);
  await waitFor(() =>
    expect(screen.getByText('Sancerre 750ml')).toBeTruthy(),
  );
  const cell = screen.getByText('Sancerre 750ml').closest('td')!;
  expect(cell.textContent).toBe('Sancerre 750ml');
});

it('ruleSizeLabel semantic matrix', () => {
  expect(ruleSizeLabel(rules[0])).toBeNull();
  expect(ruleSizeLabel(rules[1])).toBe('Regular plate · Jollof portion');
  expect(ruleSizeLabel(rules[4])).toBe('M · Ivory');
  expect(ruleSizeLabel(rules[5])).toBe('750ml');
});
