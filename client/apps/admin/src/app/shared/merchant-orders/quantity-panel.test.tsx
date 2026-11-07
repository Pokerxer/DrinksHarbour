// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import type { QuantitySave } from './quantity-types';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/merchant-order.service', () => ({
  merchantRequest: request,
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const row = {
  _id: 'own',
  version: 5,
  state: 'partially_shipped',
  lines: [{ line: 'line', quantity: 3, productName: 'Own bottle' }],
  quantityProgress: [
    {
      line: 'line',
      shipped: 1,
      delivered: 0,
      cancelled: 0,
      financialBlocks: [{ start: 1, quantity: 1, kind: 'refunded' }],
    },
  ],
};
async function view(save = vi.fn<QuantitySave>(async () => false)) {
  request.mockResolvedValue({
    allocations: [
      {
        _id: 'shipment',
        state: 'shipped',
        lines: [
          { line: 'line', quantity: 1, ranges: [{ start: 0, quantity: 1 }] },
        ],
      },
    ],
    pagination: { hasMore: false, nextCursor: null },
  });
  const imported = await vi
    .importActual<typeof import('./quantity-panel')>('./quantity-panel')
    .catch(() => ({ default: undefined }));
  expect(imported.default).toBeTypeOf('function');
  const View = imported.default!;
  render(<View row={row} token="token" busy={false} save={save} />);
  return save;
}
test('quantity panel shows original progress and submits line quantity with stable versioned retry identity', async () => {
  const save = await view();
  expect(screen.getByText(/Shipped 1.*Delivered 0.*Cancelled 0/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Units for Own bottle'), {
    target: { value: '1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ship selected units' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Ship selected units' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
  expect(save.mock.calls[0][0]).toBe('/own/quantity/ship');
  expect(save.mock.calls[0][1]).toEqual({
    lines: [{ line: 'line', quantity: 1 }],
    expectedVersion: 5,
  });
});
test('quantity panel confirms exact saved shipment and never marks entire order delivered', async () => {
  const save = await view();
  fireEvent.click(
    await screen.findByRole('button', { name: 'Confirm shipment delivered' })
  );
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      '/own/quantity/allocations/shipment/deliver',
      { expectedVersion: 5 },
      expect.any(String)
    )
  );
});
test('quantity panel rejects excess held units and explains paid cancellation boundary', async () => {
  const save = await view();
  fireEvent.change(screen.getByLabelText('Units for Own bottle'), {
    target: { value: '3' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Ship selected units' }));
  expect(screen.getByRole('alert').textContent).toMatch(/held|quantity|units/i);
  expect(save).not.toHaveBeenCalled();
  expect(screen.getByText(/verified unit refund/i)).toBeTruthy();
});
test('quantity panel cancellation sends only selected own original line quantities', async () => {
  const save = await view();
  fireEvent.change(screen.getByLabelText('Units for Own bottle'), {
    target: { value: '1' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Cancel refunded units' })
  );
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      '/own/quantity/cancel',
      { lines: [{ line: 'line', quantity: 1 }], expectedVersion: 5 },
      expect.any(String)
    )
  );
});
test('shipment page failure exposes a retry without offering stale shipment actions', async () => {
  await view();
  await screen.findByRole('button', { name: 'Confirm shipment delivered' });
  cleanup();
  request.mockRejectedValueOnce(new Error('Shipment history unavailable'));
  const View = (await import('./quantity-panel')).default;
  render(
    <View
      row={row}
      token="new-token"
      busy={false}
      save={vi.fn(async () => true)}
    />
  );
  expect(await screen.findByText('Shipment history unavailable')).toBeTruthy();
  expect(
    screen.queryByRole('button', { name: 'Confirm shipment delivered' })
  ).toBeNull();
  request.mockResolvedValueOnce({
    allocations: [],
    pagination: { hasMore: false, nextCursor: null },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry shipments' }));
  expect(await screen.findByText('No units shipped yet.')).toBeTruthy();
});
test('quantity panel reloads shipments from the first page after the child version changes', async () => {
  request.mockResolvedValueOnce({
    allocations: [],
    pagination: { hasMore: false, nextCursor: null },
  });
  const View = (await import('./quantity-panel')).default;
  const save = vi.fn(async () => true),
    mounted = render(<View row={row} token="token" busy={false} save={save} />);
  await screen.findByText('No units shipped yet.');
  request.mockResolvedValueOnce({
    allocations: [
      {
        _id: 'new',
        state: 'shipped',
        lines: [
          { line: 'line', quantity: 1, ranges: [{ start: 2, quantity: 1 }] },
        ],
      },
    ],
    pagination: { hasMore: false, nextCursor: null },
  });
  mounted.rerender(
    <View row={{ ...row, version: 6 }} token="token" busy={false} save={save} />
  );
  expect(
    await screen.findByRole('button', { name: 'Confirm shipment delivered' })
  ).toBeTruthy();
  expect(request.mock.calls.at(-1)?.[1]).toBe('/own/quantity/allocations');
});
test('malformed shipment response stays a recoverable error without rendering unvalidated rows', async () => {
  request.mockResolvedValueOnce({ allocations: undefined });
  const View = (await import('./quantity-panel')).default;
  render(
    <View row={row} token="token" busy={false} save={vi.fn(async () => true)} />
  );
  expect((await screen.findByRole('alert')).textContent).toMatch(
    /shipment|response/i
  );
  expect(screen.getByRole('button', { name: 'Retry shipments' })).toBeTruthy();
});

test('rider-managed shipment directs delivery confirmation to local rider controls', async () => {
  request.mockResolvedValue({
    allocations: [
      {
        _id: 'rider-shipment',
        state: 'shipped',
        deliveryManaged: true,
        lines: [
          { line: 'line', quantity: 1, ranges: [{ start: 0, quantity: 1 }] },
        ],
      },
    ],
    pagination: { hasMore: false, nextCursor: null },
  });
  const View = (await import('./quantity-panel')).default;
  render(
    <View row={row} token="token" busy={false} save={vi.fn(async () => true)} />
  );
  await screen.findByText(/Rider-managed delivery/);
  expect(
    screen.queryByRole('button', { name: 'Confirm shipment delivered' })
  ).toBeNull();
});
