// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { PhoneResults, type Checked } from './phone-results';
import { mergeScan } from './phone-results';
import { describe, beforeEach } from 'vitest';

afterEach(() => cleanup());

const hit = (name: string, price: number, barcode: string): Checked => ({
  barcode,
  at: Date.now(),
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

it('offers a 5s undo on the newest scan and collapses to 3 hits on tiny screens', () => {
  vi.useFakeTimers({ now: new Date('2026-11-08T10:00:00Z') });
  const onUndo = vi.fn();
  const { container } = render(
    <PhoneResults results={[hit('Fresh', 20000, '3'), hit('Older', 30000, '2'), hit('Oldest', 40000, '1'), hit('Elder', 50000, '0')]} onUndo={onUndo} />
  );
  const undo = screen.getByRole('button', { name: /undo fresh/i });
  fireEvent.click(undo);
  expect(onUndo).toHaveBeenCalledWith('3');
  // 4+ hits collapse behind a "show all" toggle
  expect(screen.getByRole('button', { name: /show all \(4\)/i })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /show all \(4\)/i }));
  expect(container.querySelectorAll('.phone-hit')).toHaveLength(4);
  vi.useRealTimers();
});

describe('mergeScan', () => {
  it('appends new barcodes and re-scans send the old entry to the top (deduped)', () => {
    const first: Checked = { barcode: '111', at: 1000, result: hit('A', 1000, '111').result };
    const second: Checked = { barcode: '222', at: 2000, result: hit('B', 2000, '222').result };
    const added = mergeScan([first], { barcode: '222', at: 3000, result: second.result });
    expect(added.deduped).toBe(false);
    expect(added.results.map((row) => row.barcode)).toEqual(['222', '111']);
    const again: Checked = { barcode: '111', at: 4000, result: first.result };
    const outcome = mergeScan([second, first], again);
    expect(outcome.deduped).toBe(true);
    expect(outcome.results).toHaveLength(2);
    expect(outcome.results[0].barcode).toBe('111');
    expect(outcome.results[0].at).toBe(4000);
  });
});
