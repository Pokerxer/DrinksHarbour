// @vitest-environment jsdom
// DRI-34 — /inventory transfers surface (checklist item 1): evidence-pin that
// Emerald/Ivory variants of one product do NOT merge in the transfer
// pickup/destination views. The real flow stores the composed snapshot at
// create (sizeVariantLabel at line entry), so the detail table and the
// destination receive panel — which both compose `subProductName – sizeName`
// from the stored item — render per-variant rows. Printed document surfaces
// stay at stored snapshot bytes (no client-side compose added).

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import StockTransferDetail from './stock-transfer-detail';
import TransferReceivePanel from './transfer-receive-panel';
import { stockTransferService, type StockTransfer, type TransferItem } from '@/services/stockTransfer.service';
import { buildTransferInvoice } from '@/utils/print/transfer-print';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { token: 't', id: 'u1', role: 'tenant_admin', name: 'Admin' },
    },
    status: 'authenticated',
  }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock('@/context/TenantContext', () => ({
  useTenant: () => ({
    tenant: { _id: 't1', name: 'Frontend Drinker Tenant', slug: 'frontend' },
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// Synthetic transfer replicating the real create flow's stored snapshots:
// each picked variant line stores the FULL composed label in `sizeName`
// (stock-transfer-create line entry, sizeVariantLabel), with the DRI-16
// additive identity siblings beside it.
const item = (over: Partial<TransferItem>): TransferItem =>
  ({
    subProductId: 'sp-tee',
    subProductName: 'Silk Tee',
    sku: 'SKU-TEE',
    quantity: 10,
    transferredQty: 0,
    ...over,
  }) as TransferItem;

const items: TransferItem[] = [
  item({
    _id: 'i-em',
    sizeId: 'sz-em',
    sizeName: 'M · Emerald',
    colorName: 'Emerald',
    colorHexCode: '#0f5132',
    costPrice: 2000,
  }),
  item({
    _id: 'i-iv',
    sizeId: 'sz-iv',
    sizeName: 'M · Ivory',
    colorName: 'Ivory',
    colorHexCode: '#f2f2ea',
    costPrice: 2000,
  }),
  // Food-service option identity (same size, different portions).
  item({
    _id: 'i-jol',
    subProductId: 'sp-plate',
    subProductName: 'Jollof plate',
    sku: 'SKU-PLT',
    sizeId: 'sz-reg',
    sizeName: 'Regular plate · Jollof portion',
    optionName: 'Jollof portion',
    costPrice: 1500,
  }),
  item({
    _id: 'i-got',
    subProductId: 'sp-plate',
    subProductName: 'Jollof plate',
    sku: 'SKU-PLT',
    sizeId: 'sz-reg',
    sizeName: 'Regular plate · Goat portion',
    optionName: 'Goat portion',
    costPrice: 1500,
  }),
  // Beverage volume/pack colourless rows.
  item({
    _id: 'i-vol',
    subProductId: 'sp-wine',
    subProductName: 'Sancerre',
    sku: 'SKU-SAN',
    sizeId: 'sz-750',
    sizeName: '750ml',
    costPrice: 8000,
  }),
  item({
    _id: 'i-case',
    subProductId: 'sp-wine',
    subProductName: 'Sancerre',
    sku: 'SKU-SAN',
    sizeId: 'sz-case',
    sizeName: 'Case of 6 (4500)',
    costPrice: 48000,
  }),
  // Legacy identity-less control.
  item({
    _id: 'i-leg',
    subProductId: 'sp-grim',
    subProductName: 'Grimbergen',
    sku: 'SKU-GRM',
    sizeId: 'sz-75',
    sizeName: '75cl',
    costPrice: 1000,
  }),
];

const transfer: StockTransfer = {
  _id: 'tr1',
  transferNumber: 'TR-2026-001',
  sourceWarehouse: { _id: 'w1', name: 'City store', managers: [] },
  destinationWarehouse: { _id: 'w2', name: 'Bar lounge', managers: [] },
  status: 'draft',
  currency: 'NGN',
  items,
  createdAt: '2026-11-05T09:00:00Z',
  createdBy: { _id: 'u1', name: 'Admin' },
} as unknown as StockTransfer;

it('detail (pickup/destination views) renders per-variant labels — Emerald/Ivory never merge', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [] }),
    })) as unknown as typeof fetch,
  );
  vi.spyOn(stockTransferService, 'get').mockResolvedValue({ success: true, data: transfer });
  render(<StockTransferDetail id="tr1" />);
  await waitFor(() =>
    expect(screen.getByText('Silk Tee – M · Emerald')).toBeTruthy(),
  );
  expect(screen.getByText('Silk Tee – M · Ivory')).toBeTruthy();
  expect(screen.getByText('Jollof plate – Regular plate · Jollof portion')).toBeTruthy();
  expect(screen.getByText('Jollof plate – Regular plate · Goat portion')).toBeTruthy();
  // Colourless volume/pack rows stay apart (750ml vs the 4500 case).
  expect(screen.getByText('Sancerre – 750ml')).toBeTruthy();
  expect(screen.getByText('Sancerre – Case of 6 (4500)')).toBeTruthy();
  // Legacy identity-less control: exact historical compose.
  expect(screen.getByText('Grimbergen – 75cl')).toBeTruthy();
});

it('destination receive panel composes the same per-variant labels over the real flow', () => {
  render(
    <TransferReceivePanel
      items={items}
      currency="NGN"
      busy={false}
      onSubmit={() => {}}
    />,
  );
  expect(screen.getByText('Silk Tee – M · Emerald')).toBeTruthy();
  expect(screen.getByText('Silk Tee – M · Ivory')).toBeTruthy();
  expect(screen.getByText('Jollof plate – Regular plate · Jollof portion')).toBeTruthy();
  expect(screen.getByText('Jollof plate – Regular plate · Goat portion')).toBeTruthy();
  expect(screen.getByText('Sancerre – Case of 6 (4500)')).toBeTruthy();
  expect(screen.getByText('Grimbergen – 75cl')).toBeTruthy();
});

it('print keeps stored snapshot bytes — never re-composes beyond the stored sizeName', () => {
  const model = buildTransferInvoice(
    { ...transfer, status: 'confirmed' } as StockTransfer,
    'City store',
  );
  const text = JSON.stringify(model);
  // Stored snapshots appear exactly as stored.
  expect(text).toContain('Silk Tee – M · Emerald');
  expect(text).toContain('Silk Tee – M · Ivory');
  expect(text).toContain('75cl');
  // An item carrying identity siblings but a bare/absent sizeName must NOT
  // gain a client-side composed label in the print bytes.
  const augmentedOnly = [
    item({
      _id: 'i-aug',
      subProductId: 'sp-aug',
      subProductName: 'Bare Product',
      sku: 'SKU-BARE',
      colorName: 'Emerald',
      colorHexCode: '#0f5132',
      costPrice: 100,
    }),
  ];
  const augmentedModel = buildTransferInvoice(
    { ...transfer, items: augmentedOnly } as StockTransfer,
    'City store',
  );
  const augmentedText = JSON.stringify(augmentedModel);
  expect(augmentedText).toContain('Bare Product');
  expect(augmentedText).not.toContain('Emerald');
});
