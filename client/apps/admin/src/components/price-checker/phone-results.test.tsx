// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { PhoneScanResult } from '../../app/kiosk/price-checker/[kioskSlug]/m/[session]/phone-api';
import { PhoneResults } from './phone-results';

afterEach(() => cleanup());

interface Checked {
  barcode: string;
  result: PhoneScanResult;
}

const hit = (name: string, price: number, barcode: string): Checked => ({
  barcode,
  result: {
    found: true,
    status: 'FOUND',
    product: { name, price, currency: 'NGN', alcoholic: false, taxLabel: '' },
  },
});

it('summarises the session and marks the cheapest hit', () => {
  render(
    <PhoneResults
      results={[hit('Glen Grant', 42000, '1'), hit('Talisker', 38000, '2')]}
    />
  );
  expect(String(screen.getByRole('region', { name: 'Session summary' }).textContent)).toContain(
    '2 bottles scanned'
  );
  expect(String(screen.getByRole('region', { name: 'Session summary' }).textContent)).toContain(
    '₦38,000'
  );
  expect(screen.getByText('Best so far')).toBeTruthy();
  expect(screen.getAllByText('Sent to the store screen ✓')).toHaveLength(2);
});

it('handles empty sessions and misses gracefully', () => {
  const { container } = render(
    <PhoneResults
      results={[
        {
          barcode: '403',
          result: { found: false, status: 'NOT_FOUND' },
        },
      ]}
    />
  );
  expect(String(container.textContent)).toContain('ask a member of staff');
  render(<PhoneResults results={[]} />);
  expect(screen.queryByRole('region', { name: 'Session summary' })).toBeNull();
});
