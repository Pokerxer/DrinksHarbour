// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/services/local-dispatch.service', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/services/local-dispatch.service')
  >()),
  dispatchRequest: state.request,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const row = {
  _id: 'owned',
  currency: 'NGN',
  fulfillmentVersion: 2,
  lines: [{ line: 'line-1', quantity: 2, productName: 'Own bottle' }],
  quantityProgress: [{ line: 'line-1', shipped: 2, cancelled: 0 }],
};
function detail(version: number, inspections: unknown[] = [], decisions: unknown[] = []) {
  return {
    _id: 'alloc-1',
    booking: 'failed-booking',
    merchantOrder: 'child-1',
    shipmentAllocation: 'alloc-1',
    disposition: 'quarantined',
    version,
    lines: [{ line: 'line-1', quantity: 2, ranges: [{ start: 0, quantity: 2 }] }],
    inspections,
    decisions,
    effects: {
      supported: false,
      reasons: [
        'Return stock/cost treatment policy is not recorded; restock, write-off and COGS effects are unsupported',
      ],
    },
    operations: inspections.length + decisions.length,
  };
}
async function view() {
  const Panel = (await import('./local-dispatch-panel')).default;
  return render(<Panel row={row} token="signed" onChange={vi.fn()} />);
}
test('returned booking records exact-unit inspection and eligible treatment decision, showing unsupported effects honestly', async () => {
  let bookingVersion = 5;
  let detailDoc = detail(1);
  state.request.mockImplementation(
    async (_token: string, path: string, method = 'GET', body?: Record<string, unknown>) => {
      if (method === 'GET' && path.includes('/options'))
        return {
          creationEnabled: false,
          contract: null,
          drivers: [],
          bookings: [
            {
              _id: 'failed-booking',
              state: 'returned',
              version: bookingVersion,
              amountMinor: 500,
              currency: 'NGN',
              lines: [{ line: 'line-1', quantity: 2 }],
              events: [],
            },
          ],
        };
      if (method === 'GET' && path.endsWith('/return'))
        return { return: detailDoc };
      if (path.endsWith('/return/inspect')) {
        expect(body).toMatchObject({
          expectedVersion: 1,
          lines: [
            {
              line: 'line-1',
              condition: 'damaged',
              ranges: [{ start: 0, quantity: 2 }],
              evidence: [{ kind: 'batch_reference', reference: 'batch-9' }],
            },
          ],
        });
        detailDoc = detail(
          2,
          [
            {
              line: 'line-1',
              condition: 'damaged',
              ranges: [{ start: 0, quantity: 2 }],
              inspectedAt: new Date().toISOString(),
            },
          ],
          []
        );
        bookingVersion = 6;
        return { return: detailDoc };
      }
      if (path.endsWith('/return/decision')) {
        expect(body).toMatchObject({
          expectedVersion: 2,
          lines: [
            { line: 'line-1', treatment: 'write_off', ranges: [{ start: 0, quantity: 2 }] },
          ],
        });
        detailDoc = detail(
          3,
          [
            {
              line: 'line-1',
              condition: 'damaged',
              ranges: [{ start: 0, quantity: 2 }],
              inspectedAt: new Date().toISOString(),
            },
          ],
          [
            {
              line: 'line-1',
              treatment: 'write_off',
              ranges: [{ start: 0, quantity: 2 }],
              decidedAt: new Date().toISOString(),
            },
          ]
        );
        bookingVersion = 7;
        return { return: detailDoc };
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    }
  );
  await view();
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  expect(await screen.findByText(/unit ranges/i)).toBeTruthy();
  await fireEvent.change(
    await screen.findByRole('combobox', { name: 'Condition for line-1' }),
    { target: { value: 'damaged' } }
  );
  await fireEvent.change(
    screen.getByRole('combobox', { name: 'Evidence kind for line-1' }),
    { target: { value: 'batch_reference' } }
  );
  await fireEvent.change(
    screen.getByRole('textbox', { name: 'Evidence reference for line-1' }),
    { target: { value: 'batch-9' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Record inspection' }));
  await waitFor(() =>
    expect(state.request).toHaveBeenCalledWith(
      'signed',
      '/bookings/failed-booking/return/inspect',
      'POST',
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    )
  );
  const treatment = (await screen.findByRole('combobox', {
    name: 'Treatment for line-1',
  })) as HTMLSelectElement;
  const options = Array.from(treatment.options).map(
    (option) => option.value
  );
  expect(options).toContain('write_off');
  expect(options).toContain('retain_quarantine');
  expect(options).not.toContain('restock');
  await fireEvent.change(treatment, { target: { value: 'write_off' } });
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm treatment decision' })
  );
  await waitFor(() =>
    expect(state.request).toHaveBeenCalledWith(
      'signed',
      '/bookings/failed-booking/return/decision',
      'POST',
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    )
  );
  expect(
    await screen.findByText(/policy is not recorded/i)
  ).toBeTruthy();
  expect(await screen.findByText(/write_off · line-1/i)).toBeTruthy();
});
test('sealed inspection offers restock decision explicitly', async () => {
  state.request.mockImplementation(
    async (_token: string, path: string, method = 'GET') => {
      if (method === 'GET' && path.includes('/options'))
        return {
          creationEnabled: false,
          contract: null,
          drivers: [],
          bookings: [
            {
              _id: 'failed-booking',
              state: 'returned',
              version: 5,
              amountMinor: 500,
              currency: 'NGN',
              lines: [{ line: 'line-1', quantity: 2 }],
              events: [],
            },
          ],
        };
      if (method === 'GET' && path.endsWith('/return'))
        return {
          return: detail(2, [
            {
              line: 'line-1',
              condition: 'sealed',
              ranges: [{ start: 0, quantity: 2 }],
              inspectedAt: new Date().toISOString(),
            },
          ]),
        };
      throw new Error(`Unexpected request: ${method} ${path}`);
    }
  );
  await view();
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  const treatment = (await screen.findByRole('combobox', {
    name: 'Treatment for line-1',
  })) as HTMLSelectElement;
  const options = Array.from(treatment.options).map(
    (option) => option.value
  );
  expect(options).toContain('restock');
  expect(options).toContain('retain_quarantine');
  expect(options).not.toContain('write_off');
});
test('return disposition never displays another order or stale session response', async () => {
  let resolveOld: (value: unknown) => void = () => {};
  state.request.mockImplementation((token: string, path: string) =>
    path.includes('owned')
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve({
          creationEnabled: false,
          contract: null,
          drivers: [],
          bookings: [],
        })
  );
  const Panel = (await import('./local-dispatch-panel')).default;
  const rendered = render(<Panel row={row} token="old-session" />);
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  rendered.rerender(
    <Panel row={{ ...row, _id: 'other-order' }} token="new-session" />
  );
  await act(async () =>
    resolveOld({
      creationEnabled: false,
      contract: null,
      drivers: [],
      bookings: [
        {
          _id: 'old-booking',
          state: 'returned',
          version: 3,
          amountMinor: 500,
          currency: 'NGN',
          lines: [],
          events: [],
        },
      ],
    })
  );
  await waitFor(() => expect(screen.queryByText(/unit ranges/i)).toBeNull());
});
