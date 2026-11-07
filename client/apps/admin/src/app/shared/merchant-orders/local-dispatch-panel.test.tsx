// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import {
  cleanup,
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
  lines: [{ line: 'line', quantity: 3, productName: 'Own bottle' }],
  quantityProgress: [{ line: 'line', shipped: 0, cancelled: 0 }],
};
const contract = {
  _id: 'reviewed',
  version: 1,
  currency: 'NGN',
  amountMinor: 500,
  coverage: ['Abuja, FCT, Nigeria'],
  validUntil: '2035-01-01',
  maxUnits: 3,
  maxWeightGrams: 5000,
  capabilities: { alcohol: false, ageVerification: false, fragile: false },
};
const driver = {
  _id: 'rider',
  name: 'Own rider',
  vehicleType: 'bike',
  capacityKg: 10,
};
async function view() {
  const imported = await import('./local-dispatch-panel').catch(() => ({
    default: undefined,
  }));
  expect(imported.default).toBeTypeOf('function');
  return render(
    imported.default ? (
      <imported.default row={row} token="signed" onChange={vi.fn()} />
    ) : null
  );
}
test('operator reviews rate, quotes exact quantities, books, dispatches and records own drop', async () => {
  let booking:
    | undefined
    | {
        _id: string;
        state: string;
        version: number;
        amountMinor: number;
        currency: string;
        lines: { line: string; quantity: number }[];
        events: never[];
      };
  state.request.mockImplementation(
    async (_token: string, path: string, method = 'GET') => {
      if (method === 'GET')
        return {
          creationEnabled: true,
          contract,
          drivers: [driver],
          bookings: booking ? [booking] : [],
        };
      if (path.endsWith('/quotes'))
        return {
          quote: {
            _id: 'quote',
            amountMinor: 500,
            currency: 'NGN',
            expiresAt: '2035-01-01',
          },
        };
      booking = {
        _id: 'booking',
        state: path.endsWith('/resolve')
          ? 'delivered'
          : path.endsWith('/dispatch')
            ? 'dispatched'
            : 'booked',
        version: path.endsWith('/resolve')
          ? 3
          : path.endsWith('/dispatch')
            ? 2
            : 1,
        amountMinor: 500,
        currency: 'NGN',
        lines: [{ line: 'line', quantity: 1 }],
        events: [],
      };
      return { booking };
    }
  );
  await view();
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  await screen.findByText('Abuja, FCT, Nigeria');
  fireEvent.change(screen.getByLabelText('Quantity for Own bottle'), {
    target: { value: '1' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Get reviewed quote' }));
  await screen.findByText(/Quote expires/);
  fireEvent.change(screen.getByLabelText('Available own rider'), {
    target: { value: 'rider' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Book local rider' }));
  await screen.findByText('booked');
  fireEvent.click(
    screen.getByRole('button', { name: 'Dispatch selected goods' })
  );
  await screen.findByText('dispatched');
  fireEvent.change(screen.getByLabelText('Recipient name'), {
    target: { value: 'Own recipient' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Record delivered drop' })
  );
  await screen.findByText('delivered');
  expect(state.request).toHaveBeenCalledWith(
    'signed',
    '/orders/owned/quotes',
    'POST',
    { lines: [{ line: 'line', quantity: 1 }] }
  );
  expect(state.request).toHaveBeenCalledWith(
    'signed',
    '/bookings/booking/resolve',
    'POST',
    expect.objectContaining({
      status: 'delivered',
      expectedVersion: 2,
      proofOfDelivery: { recipientName: 'Own recipient' },
      idempotencyKey: expect.any(String),
    })
  );
});
test('uncertain dispatch retries keep the same saved operation identity', async () => {
  let attempts = 0;
  const booking = {
    _id: 'booking',
    state: 'booked',
    version: 1,
    amountMinor: 0,
    currency: 'NGN',
    lines: [{ line: 'line', quantity: 1 }],
    events: [],
  };
  state.request.mockImplementation(
    async (_token: string, _path: string, method = 'GET') => {
      if (method === 'GET')
        return {
          creationEnabled: false,
          contract: null,
          drivers: [],
          bookings: [booking],
        };
      attempts++;
      throw new Error('Temporary network failure');
    }
  );
  await view();
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  await screen.findByText('booked');
  fireEvent.click(
    screen.getByRole('button', { name: 'Dispatch selected goods' })
  );
  await screen.findByText('Temporary network failure');
  fireEvent.click(
    screen.getByRole('button', { name: 'Dispatch selected goods' })
  );
  await waitFor(() => expect(attempts).toBe(2));
  const writes = state.request.mock.calls.filter((call) => call[2] === 'POST');
  expect(writes[0][3].idempotencyKey).toBe(writes[1][3].idempotencyKey);
  expect(writes[1][3].expectedVersion).toBe(1);
});
test('missing reviewed terms cannot create a new rider promise', async () => {
  state.request.mockResolvedValue({
    creationEnabled: true,
    contract: null,
    drivers: [],
    bookings: [],
  });
  await view();
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  await screen.findByText(/No current reviewed local delivery terms/);
  expect(
    screen.queryByRole('button', { name: 'Get reviewed quote' })
  ).toBeNull();
});
