// @vitest-environment jsdom
// DRI-34 — procurement suggestion rows (checklist item 9, client side).
// The backend emits the per-variant identity (sizeId + displayName/colour/
// option) ONLY when identity exists (emit-only-with-identity). Rows render the
// shared composed label then; sizeless/legacy rows stay byte-identical and the
// Raise PO hand-off only exists for rows carrying the exact Size target.

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { reorderService, type ReorderSuggestion } from '@/services/reorder.service';
import InventoryProcurement, {
  suggestionSizeLabel,
} from './inventory-procurement';
import { raisePoQuery } from './inventory-procurement-helpers';

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

const suggestion = (over: Partial<ReorderSuggestion>): ReorderSuggestion =>
  ({
    subProductId: 'sp1',
    sku: 'SKU-1',
    product: { name: 'Silk Tee' },
    currentStock: 0,
    reorderPoint: 5,
    reorderQuantity: 20,
    suggestedQuantity: 20,
    leadTimeDays: 3,
    unitCost: 500,
    estimatedCost: 10000,
    urgency: 'high',
    ...over,
  }) as ReorderSuggestion;

const rows: ReorderSuggestion[] = [
  suggestion({ subProductId: 'sp-wine', sku: 'SKU-W1', product: { name: 'Sancerre 750ml' } }),
  // Fashion Emerald/Ivory: same SubProduct split per exact Size id, real
  // DRI-33 wire shape (sizeId + size + displayName + verbatim identity).
  suggestion({
    subProductId: 'sp-tee',
    sizeId: 'sz-emerald',
    size: 'M',
    displayName: 'M',
    colorName: 'Emerald',
    colorHexCode: '#0f5132',
  }),
  suggestion({
    subProductId: 'sp-tee',
    sizeId: 'sz-ivory',
    size: 'M',
    displayName: 'M',
    colorName: 'Ivory',
  }),
  // Electronics option-only.
  suggestion({
    subProductId: 'sp-spk',
    sku: 'SKU-SPK',
    product: { name: 'Cabinet Speaker' },
    sizeId: 'sz-wifi',
    size: 'Standard',
    displayName: 'Standard',
    optionName: 'With Wi-Fi',
  }),
  // Home option-only.
  suggestion({
    subProductId: 'sp-shelf',
    sku: 'SKU-SHF',
    product: { name: 'Oak Shelf' },
    sizeId: 'sz-draw',
    size: 'Wall unit',
    displayName: 'Wall unit',
    optionName: 'With drawers',
  }),
  // Colourless beverage VOLUME and PACK variant rows (identity-less Size).
  suggestion({
    subProductId: 'sp-vol',
    sku: 'SKU-VOL',
    product: { name: 'Chianti' },
    sizeId: 'sz-750',
    size: '750ml',
    displayName: '750ml',
  }),
  suggestion({
    subProductId: 'sp-vol',
    sku: 'SKU-VOL',
    product: { name: 'Chianti' },
    sizeId: 'sz-case',
    size: 'Case of 6 (4500)',
    displayName: 'Case of 6 (4500)',
  }),
];

it('renders the shared composed label per variant; Emerald/Ivory stay distinct', async () => {
  vi.spyOn(reorderService, 'getSuggestions').mockResolvedValue({ data: rows });
  render(<InventoryProcurement />);
  await waitFor(() =>
    expect(screen.getAllByRole('link', { name: 'Raise PO' })).toHaveLength(6),
  );
  expect(screen.getByText('M · Emerald')).toBeTruthy();
  expect(screen.getByText('M · Ivory')).toBeTruthy();
  expect(screen.getByText('Standard · With Wi-Fi')).toBeTruthy();
  expect(screen.getByText('Wall unit · With drawers')).toBeTruthy();
  // Colourless beverage variant rows carry their volume/pack label.
  expect(screen.getAllByText('750ml')).toHaveLength(1);
  expect(screen.getByText('Case of 6 (4500)')).toBeTruthy();
});

it('sizeless legacy suggestions keep the exact legacy row — no variant label, no Raise PO', async () => {
  vi.spyOn(reorderService, 'getSuggestions').mockResolvedValue({
    data: [rows[0]],
  });
  render(<InventoryProcurement />);
  await waitFor(() =>
    expect(screen.getByText('Sancerre 750ml')).toBeTruthy(),
  );
  expect(screen.getByText('SKU-W1')).toBeTruthy();
  expect(screen.queryByText('Raise PO')).toBeNull();
  const rowCell = screen.getByText('Sancerre 750ml').closest('td')!;
  expect(rowCell.textContent).toBe('Sancerre 750mlSKU-W1');
});

it('Raise PO hand-off forwards the exact picker identity pair as query state', async () => {
  vi.spyOn(reorderService, 'getSuggestions').mockResolvedValue({
    data: [rows[1], rows[2]],
  });
  render(<InventoryProcurement />);
  await waitFor(() =>
    expect(screen.getAllByRole('link', { name: 'Raise PO' })).toHaveLength(2),
  );
  const links = screen.getAllByRole('link', { name: 'Raise PO' });
  expect(raisePoQuery(rows[1]).get('subProduct')).toBe('sp-tee');
  expect(raisePoQuery(rows[1]).get('size')).toBe('sz-emerald');
  expect(raisePoQuery(rows[2]).get('size')).toBe('sz-ivory');
  expect(links[0].getAttribute('href')).toContain(
    `/purchases/create?${raisePoQuery(rows[1]).toString()}`,
  );
  expect(links[1].getAttribute('href')).toContain(
    `/purchases/create?${raisePoQuery(rows[2]).toString()}`,
  );
});

it('suggestionSizeLabel consumes the DRI-33 flat shape and the defensive populated-Size shape', () => {
  // Real DRI-33 wire shape: sizeId + size + displayName + verbatim identity.
  expect(
    suggestionSizeLabel(
      suggestion({
        sizeId: 'sz-jol',
        size: 'Regular plate',
        displayName: 'Regular plate',
        optionName: 'Goat portion',
      }),
    ),
  ).toBe('Regular plate · Goat portion');
  expect(
    suggestionSizeLabel(
      suggestion({ sizeId: 'sz-750', size: '750ml', displayName: '750ml' }),
    ),
  ).toBe('750ml');
  // Defensive flat-sibling alternate (color/option beside sizeName).
  expect(
    suggestionSizeLabel(
      suggestion({ sizeId: 'sz-b', sizeName: 'Reg2', colorName: 'Emerald' }),
    ),
  ).toBe('Reg2 · Emerald');
  // Defensive populated-Size object shape (DRI-29 movement-populate mirror).
  expect(
    suggestionSizeLabel({
      ...suggestion({ sizeId: 'sz-a' }),
      size: { displayName: 'Regular plate', optionName: 'Jollof portion' },
    }),
  ).toBe('Regular plate · Jollof portion');
  // Identity-less LEGACY suggestions (no sizeId) never compose.
  expect(suggestionSizeLabel(rows[0])).toBeNull();
});

it('variant rows of one product no longer collide on the row key', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(reorderService, 'getSuggestions').mockResolvedValue({
    data: [rows[1], rows[2]],
  });
  const { container } = render(<InventoryProcurement />);
  await waitFor(() =>
    expect(screen.getAllByRole('link', { name: 'Raise PO' })).toHaveLength(2),
  );
  const keyErrors = errorSpy.mock.calls.filter(([msg]) =>
    String(msg).includes('Duplicate'),
  );
  expect(keyErrors).toHaveLength(0);
  expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
});
