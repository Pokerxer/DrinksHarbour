// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import PurchaseSummary from './purchase-summary';
afterEach(cleanup);
it('shows summed receipt and return totals per currency, including zero after a full return', () => {
  render(
    <PurchaseSummary
      summary={{
        currencies: [
          {
            currency: 'NGN',
            receivedQuantity: 30,
            returnedQuantity: 4,
            netReceivedQuantity: 26,
            receivedValue: 3000,
            returnedValue: 400,
            netReceivedValue: 2600,
          },
          {
            currency: 'USD',
            receivedQuantity: 5,
            returnedQuantity: 5,
            netReceivedQuantity: 0,
            receivedValue: 50,
            returnedValue: 50,
            netReceivedValue: 0,
          },
        ],
      }}
    />,
  );
  const table = screen.getByRole('table', { name: 'All matching purchases' });
  expect(table.textContent).toContain('Total purchased after returns');
  expect(table.textContent).toContain('26 units');
  expect(table.textContent).toContain('NGN 2,600.00');
  expect(table.textContent).toContain('0 units');
  expect(table.textContent).toContain('USD 0.00');
});
