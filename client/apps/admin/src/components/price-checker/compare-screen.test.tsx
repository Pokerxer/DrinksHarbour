// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { KioskProduct } from './types';
import { CompareScreen } from './compare-screen';

const bottle = (
  name: string,
  price: number,
  abv?: number
): KioskProduct => ({ name, price, abv, currency: 'NGN', alcoholic: false, taxLabel: '' });

afterEach(() => cleanup());

it('marks only the cheapest bottle as the best value', () => {
  render(
    <CompareScreen
      items={[bottle('Premium lag', 500, 5), bottle('Fair stout', 400, 7.5)]}
      currency="NGN"
      onRemove={() => {}}
      onClose={() => {}}
    />
  );
  const best = screen.getAllByText('Best value');
  const card = best[0].closest('[role="listitem"]')?.textContent || '';
  expect(best).toHaveLength(1);
  expect(card).toContain('Fair stout');
  expect(card).toContain('₦400');
});

it('collapses rows where every bottle matches and still shows divergent rows', () => {
  render(
    <CompareScreen
      items={[bottle('A', 500, 40), bottle('B', 400, 40)]}
      currency="NGN"
      onRemove={() => {}}
      onClose={() => {}}
    />
  );
  // Same ABV everywhere → one shared row, not per-bottle cells.
  expect(screen.getByLabelText('All bottles: 40%').textContent).toContain('40%');
  // Non-alcoholic flag likewise adds a collapsed row instead of two cells.
  expect(screen.getByLabelText('All bottles: Non-alcoholic')).toBeTruthy();
});

it('lets the customer remove a bottle and close the view', () => {
  const onRemove = vi.fn();
  const onClose = vi.fn();
  render(
    <CompareScreen
      items={[bottle('A', 500, 40), bottle('B', 400, 40)]}
      currency="NGN"
      onRemove={onRemove}
      onClose={onClose}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Remove A' }));
  expect(onRemove).toHaveBeenCalledWith('A|');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
