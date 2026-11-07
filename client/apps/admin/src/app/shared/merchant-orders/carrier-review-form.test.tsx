// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import Form from './carrier-review-form';
afterEach(cleanup);
test('carrier review confirms every explicit term and retains its exact version after an uncertain write and refresh', async () => {
  const save = vi.fn().mockResolvedValue(false);
  const props = { tenant: 'own-tenant', location: 'own-location', version: 1, busy: false, save };
  const view = render(<Form {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Review carrier terms' }));
  const values = {
    'Carrier account reference': 'ORIGINAL',
    'Reviewed courier ID': 'dellyman',
    'Reviewed service code': 'parcel',
    'Provider parcel category': '1',
    'Maximum carrier units': '5',
    'Maximum carrier weight (grams)': '5000',
    'Carrier review evidence': 'Reviewed synthetic capability contract',
    'Carrier review valid until': '2031-01-01T12:00',
  };
  for (const [label, value] of Object.entries(values))
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  for (const label of [
    'Carrier alcohol handling',
    'Carrier age verification',
    'Carrier fragile handling',
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'no' } });
  fireEvent.click(screen.getByRole('button', { name: 'Review exact carrier terms' }));
  const confirmation = screen.getByRole('region', { name: 'Confirm carrier review' });
  expect(confirmation.textContent).toContain('Version 1');
  expect(confirmation.textContent).toContain('ORIGINAL');
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm exact carrier review' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(save.mock.calls[0][0]).toMatchObject({
    tenant: 'own-tenant',
    location: 'own-location',
    version: 1,
    account: 'ORIGINAL',
    allowedServices: [{ courierId: 'dellyman', serviceCode: 'parcel' }],
    capabilities: { alcohol: false, ageVerification: false, fragile: false },
  });
  view.rerender(<Form {...props} version={2} />);
  expect(screen.getByRole('region', { name: 'Confirm carrier review' }).textContent).toContain(
    'Version 1',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Confirm exact carrier review' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][0].version).toBe(1);
});
