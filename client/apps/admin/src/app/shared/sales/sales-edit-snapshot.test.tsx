// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesCreateEditor from './sales-create-editor';
import type { SalesOrder } from '@/services/salesOrder.service';
vi.mock('./sales-customer-bar', () => ({ default: () => null }));
vi.mock('./sales-line-table', () => ({
  default: ({
    lines,
  }: {
    lines: { unitPrice: number; lineTotal: number }[];
  }) => (
    <p>
      Saved line {lines[0]?.unitPrice} / {lines[0]?.lineTotal}
    </p>
  ),
}));
vi.mock('./sales-totals', () => ({
  default: ({ grandTotal }: { grandTotal: number }) => (
    <p>Document total {grandTotal}</p>
  ),
}));
vi.mock('./sales-other-info-tab', () => ({ default: () => null }));
afterEach(cleanup);
it('locked editor displays saved line amounts and totals rather than changed live price previews', () => {
  const form = {
    tab: 'lines',
    priced: [{ unitPrice: 9000, lineTotal: 9000 }],
    grandTotal: 9000,
    warehouses: [],
    setTab: () => {},
  } as never;
  const snapshot = {
    items: [
      {
        _id: 'line',
        lineType: 'product',
        quantity: 2,
        unitPrice: 250,
        lineTotal: 500,
        taxAmount: 0,
      },
    ],
    total: 500,
    subtotal: 500,
  } as SalesOrder;
  render(
    <SalesCreateEditor
      form={form}
      snapshot={snapshot}
      readOnly
      token="token"
      invoice={false}
      onUpdatePrices={() => {}}
      onImportCart={() => {}}
      onCoupon={async () => {}}
      couponBusy={false}
    />,
  );
  expect(screen.getByText('Saved line 250 / 500')).toBeTruthy();
  expect(screen.getByText('Document total 500')).toBeTruthy();
  expect(
    (screen.getByRole('button', { name: 'Other Info' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
