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
  lines: [{ line: 'line', quantity: 3, productName: 'Own bottle' }],
  quantityProgress: [{ line: 'line', shipped: 0, cancelled: 0 }],
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
test('failed booking exposes explicit retry and separate quarantined return receipt', async () => {
  let phase = 'failed',
    version = 3;
  state.request.mockImplementation(
    async (
      _token: string,
      path: string,
      method = 'GET',
      body?: Record<string, unknown>
    ) => {
      if (method === 'GET')
        return {
          creationEnabled: false,
          contract: null,
          drivers: [],
          recoveryDrivers: [driver],
          bookings: [
            {
              _id: 'failed-booking',
              state: phase,
              version,
              amountMinor: 500,
              currency: 'NGN',
              lines: [{ line: 'line', quantity: 1 }],
              events: [],
            },
          ],
        };
      if (path.endsWith('/recover')) {
        phase =
          body?.action === 'reattempt'
            ? 'dispatched'
            : body?.action === 'return'
              ? 'returning'
              : 'returned';
        version++;
        return { booking: {} };
      }
      throw new Error('Unexpected action');
    }
  );
  await view();
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  const reason = await screen.findByRole('textbox', {
    name: 'Recovery reason',
  });
  fireEvent.change(reason, {
    target: { value: 'Recipient confirmed available' },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'Retry rider' }), {
    target: { value: 'rider' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Reattempt original delivery' })
  );
  await waitFor(() =>
    expect(state.request).toHaveBeenCalledWith(
      'signed',
      '/bookings/failed-booking/recover',
      'POST',
      expect.objectContaining({
        action: 'reattempt',
        driverId: 'rider',
        expectedVersion: 3,
        reason: 'Recipient confirmed available',
        idempotencyKey: expect.any(String),
      })
    )
  );
  phase = 'failed';
  version = 5;
  fireEvent.click(screen.getByRole('button', { name: 'Local rider delivery' }));
  fireEvent.click(
    await screen.findByRole('button', { name: 'Request goods return' })
  );
  expect(
    await screen.findByText(/no stock or money is restored/i)
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirm receipt into quarantine' })
  );
  expect(
    await screen.findByText(/physically received into quarantine/i)
  ).toBeTruthy();
});

test('local dispatch never displays previous order or session response after context changes', async () => {
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
          state: 'failed',
          version: 3,
          amountMinor: 500,
          currency: 'NGN',
          lines: [],
          events: [],
        },
      ],
    })
  );
  await waitFor(() => expect(screen.queryByText('failed')).toBeNull());
});
