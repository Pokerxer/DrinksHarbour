// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/services/carrier.service', () => ({ carrierRequest: request }));
import View from './carrier-panel';
import type { CarrierOptions } from '@/services/carrier.service';
const row = { _id: 'own', tenant: 'tenant', location: 'location', fulfillmentVersion: 2 };
const options: CarrierOptions = { enabled: false, ready: false, review: null, allocations: [], bookings: [] };
afterEach(() => {
  cleanup();
  request.mockReset();
});
test('measured package fields stay locked until the original quote request finishes', async () => {
  let finish: (value: unknown) => void = () => {};
  request.mockImplementation((_token, path) => path.endsWith('/quotes') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ ...options, enabled: true, ready: true, allocations: [{ _id: 'allocation', lines: [] }] }));
  render(<View row={row} token="own-session" platform={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'External parcel delivery' }));
  await screen.findByLabelText('Carrier shipment');
  fireEvent.change(screen.getByLabelText('Carrier shipment'), { target: { value: 'allocation' } });
  for (const label of ['Package length (cm)', 'Package width (cm)', 'Package height (cm)']) fireEvent.change(screen.getByLabelText(label), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Carrier pickup date'), { target: { value: '2030-01-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Get reviewed carrier rates' }));
  expect((screen.getByLabelText('Carrier pickup date') as HTMLInputElement).disabled).toBe(true);
  finish({ quote: { _id: 'quote', allocationId: 'allocation', expiresAt: '2031-01-01', rates: [] } });
  await screen.findByText(/Quoted rates expire/);
});
test('carrier screen shows disabled creation honestly and keeps platform review away from merchants', async () => {
  request.mockResolvedValue(options);
  render(<View row={row} token="own-session" platform={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'External parcel delivery' }));
  expect(
    await screen.findByText(
      'New carrier booking is disabled. Existing responsibilities remain available.',
    ),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Review carrier terms' })).toBeNull();
  expect(request.mock.calls.every((call) => call[2] === undefined || call[2] === 'GET')).toBe(true);
});
test('carrier booking requires exact charge confirmation and uncertain responsibility is never silently resubmitted', async () => {
  let booked = false;
  request.mockImplementation(async (_token, path, method) => {
    if (path.endsWith('/quotes'))
      return {
        quote: {
          _id: 'quote',
          allocationId: 'allocation',
          currency: 'NGN',
          expiresAt: '2031-01-01',
          rates: [
            {
              courierId: '1',
              serviceCode: 'parcel',
              name: 'Reviewed parcel',
              amountMinor: 1234,
              displayMinor: 1500,
            },
          ],
        },
      };
    if (method === 'POST' && path.endsWith('/bookings')) {
      booked = true;
      return {
        booking: {
          _id: 'booking',
          allocationId: 'allocation',
          state: 'uncertain',
          providerStatus: null,
          amountMinor: 1234,
          displayMinor: 1500,
        },
      };
    }
    return {
      ...options,
      enabled: true,
      ready: true,
      allocations: [{ _id: 'allocation', lines: [{ line: 'line', quantity: 1 }] }],
      bookings: booked
        ? [
            {
              _id: 'booking',
              allocationId: 'allocation',
              state: 'uncertain',
              providerStatus: null,
              amountMinor: 1234,
              displayMinor: 1500,
            },
          ]
        : [],
    };
  });
  render(<View row={row} token="own-session" platform={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'External parcel delivery' }));
  await screen.findByLabelText('Carrier shipment');
  fireEvent.change(screen.getByLabelText('Carrier shipment'), { target: { value: 'allocation' } });
  for (const label of ['Package length (cm)', 'Package width (cm)', 'Package height (cm)'])
    fireEvent.change(screen.getByLabelText(label), { target: { value: '10' } });
  fireEvent.change(screen.getByLabelText('Carrier pickup date'), {
    target: { value: '2030-01-01' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Get reviewed carrier rates' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Choose Reviewed parcel' }));
  expect(screen.getByRole('region', { name: 'Confirm carrier charge' }).textContent).toContain(
    '12.34',
  );
  expect(request.mock.calls.filter((call) => call[1].endsWith('/bookings'))).toHaveLength(0);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm carrier booking' }));
  await screen.findByText(
    'Outcome uncertain. Keep the original responsibility; do not create another shipment.',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh carrier responsibilities' }));
  await waitFor(() =>
    expect(request.mock.calls.filter((call) => call[1].endsWith('/bookings'))).toHaveLength(1),
  );
});
test('switching customer operation sessions discards a late carrier read', async () => {
  let release: (value: typeof options) => void = () => {};
  request.mockImplementation((token) =>
    token === 'old'
      ? new Promise((resolve) => {
          release = resolve;
        })
      : Promise.resolve(options),
  );
  const view = render(<View row={row} token="old" platform={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'External parcel delivery' }));
  view.rerender(<View row={row} token="new" platform={false} />);
  release({
    ...options,
    review: { _id: 'PRIVATE', version: 1, status: 'reviewed', validUntil: '2031' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'External parcel delivery' }));
  await screen.findByText(
    'New carrier booking is disabled. Existing responsibilities remain available.',
  );
  expect(screen.queryByText(/PRIVATE/)).toBeNull();
});
