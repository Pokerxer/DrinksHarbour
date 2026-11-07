// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
afterEach(cleanup);
const row = {
  _id: 'own',
  order: 'parent',
  tenant: 'tenant',
  location: 'location',
  currency: 'NGN',
  state: 'accepted' as const,
  fulfillmentVersion: 2 as const,
  version: 5,
  lines: [
    {
      line: 'line',
      product: 'p',
      subproduct: 's',
      size: 'size',
      quantity: 3,
      merchandiseMinor: 1001,
      productName: 'Own bottle',
    },
  ],
  merchandiseMinor: 1001,
  shippingMinor: 0,
  taxMinor: 0,
  totalMinor: 1001,
  refundedMinor: 0,
  refundReservedMinor: 0,
  quantityProgress: [
    {
      line: 'line',
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      financialBlocks: [],
    },
  ],
};
async function view(save = vi.fn(async () => true)) {
  const imported = await vi
    .importActual<
      typeof import('./quantity-refund-panel')
    >('./quantity-refund-panel')
    .catch(() => ({ default: undefined }));
  expect(imported.default).toBeTypeOf('function');
  const View = imported.default!;
  render(<View row={row} busy={false} save={save} />);
  return save;
}
test('quantity refund submits original units and version while server determines money', async () => {
  const save = await view();
  fireEvent.change(screen.getByLabelText('First unit'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Number of units to refund'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Unit refund reason'), {
    target: { value: 'Damaged before dispatch' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Request unit refund' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      '/own/quantity-refunds',
      {
        lines: [{ line: 'line', ranges: [{ start: 1, quantity: 2 }] }],
        expectedVersion: 5,
        reason: 'Damaged before dispatch',
      },
      expect.any(String)
    )
  );
  expect(JSON.stringify(save.mock.calls[0])).not.toContain('amountMinor');
});
test('quantity refund rejects units outside original purchase before submitting', async () => {
  const save = await view();
  fireEvent.change(screen.getByLabelText('First unit'), {
    target: { value: '3' },
  });
  fireEvent.change(screen.getByLabelText('Number of units to refund'), {
    target: { value: '2' },
  });
  fireEvent.change(screen.getByLabelText('Unit refund reason'), {
    target: { value: 'Damaged before dispatch' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Request unit refund' }));
  expect(screen.getByRole('alert').textContent).toMatch(
    /original|range|units/i
  );
  expect(save).not.toHaveBeenCalled();
});
