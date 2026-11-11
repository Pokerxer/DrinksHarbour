// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { KioskProduct } from './types';
import { CompareScreen } from './compare-screen';

const bottle = (
  name: string,
  price: number,
  abv?: number
): KioskProduct => ({ name, price, abv, currency: 'NGN', alcoholic: false, taxLabel: '' });

afterEach(() => cleanup());

it('compares actual selling prices without declaring a winner', () => {
  render(
    <CompareScreen items={[bottle('Premium lager', 500), bottle('Stout', 400)]}
      currency="NGN" onRemove={() => {}} onClose={() => {}} />
  );
  expect(screen.getAllByText('₦400')).toHaveLength(2);
  expect(screen.getByRole('rowheader', { name: 'Price' })).toBeTruthy();
  expect(screen.queryByText('Best value')).toBeNull();
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

it('compares category, subcategory, grape variety, brand and exact size', () => {
  render(
    <CompareScreen
      items={[
        {
          name: 'A',
          price: 5000,
          currency: 'NGN',
          alcoholic: true,
          taxLabel: '',
          abv: 40,
          volumeMl: 700,
          category: 'Red wine',
          subCategory: 'Varietal wine',
          grapeVarieties: ['Merlot'],
          brand: 'Grape estate',
          size: '75cl',
        },
        {
          name: 'B',
          price: 7000,
          currency: 'NGN',
          alcoholic: true,
          taxLabel: '',
          abv: 40,
          volumeMl: 1000,
          category: 'Red wine',
          subCategory: 'Blend',
          grapeVarieties: ['Syrah'],
          brand: 'Hillside',
          size: '1L',
        },
      ]}
      currency="NGN"
      onRemove={() => {}}
      onClose={() => {}}
    />
  );
  const labels = [
    ...document.querySelectorAll('.kiosk-compare-rows th'),
  ].map((cell) => cell.textContent);
  expect(labels).toEqual(expect.arrayContaining(['Category', 'Subcategory', 'Grape variety', 'Brand', 'Size', 'Price']));
  expect(labels).not.toContain('Price per ml');
  expect(labels).not.toContain('Cost per drink');
});

it('renders the decision headline above the table', () => {
  render(
    <CompareScreen
      items={[
        { ...bottle('A', 42000), size: '70cl', beverageType: 'spirit' },
        { ...bottle('B', 57000), size: '70cl', beverageType: 'spirit' },
      ]}
      currency="NGN"
      onRemove={() => {}}
      onClose={() => {}}
    />
  );
  const verdict = screen.getByRole('status');
  expect(String(verdict.textContent)).toContain('Both bottles');
});

it('supports tap-to-highlight on a compared bottle', () => {
  const { container, rerender } = render(
    <CompareScreen
      items={[bottle('A', 500, 40), bottle('B', 400, 40)]}
      currency="NGN"
      onRemove={() => {}}
      onClose={() => {}}
    />
  );
  const cardA = container.querySelector('.kiosk-compare-card');
  expect(cardA?.getAttribute('data-focus')).toBe('false');
  fireEvent.click(cardA!);
  expect(container.querySelector('.kiosk-compare-card')?.getAttribute('data-focus')).toBe('true');
  fireEvent.click(container.querySelector('.kiosk-compare-card')!);
  expect(container.querySelector('.kiosk-compare-card')?.getAttribute('data-focus')).toBe('false');
  // focusing B clears A
  fireEvent.click(cardA!);
  const cardB = container.querySelectorAll('.kiosk-compare-card')[1];
  fireEvent.click(cardB);
  expect(container.querySelectorAll('.kiosk-compare-card')[0].getAttribute('data-focus')).toBe('false');
  expect(cardB.getAttribute('data-focus')).toBe('true');
});

describe('differences-only and stock-aware compare', () => {
  const oosBottle = {
    name: 'Sold out',
    price: 300,
    currency: 'NGN',
    alcoholic: false,
    taxLabel: '',
    availability: 'OUT_OF_STOCK' as const,
  };

  it('hides shared rows and shows only divergent ones in differences-only mode', () => {
    render(
      <CompareScreen
        items={[
          { ...bottle('A', 500, 40), size: '70cl', beverageType: 'spirit' },
          { ...bottle('B', 400, 40), size: '70cl', beverageType: 'spirit' },
        ]}
        currency="NGN"
        onRemove={() => {}}
        onClose={() => {}}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /differences only/i }));
    expect(screen.queryByLabelText('All bottles: Non-alcoholic')).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'Price' })).toBeTruthy();
  });

  it('keeps stock information visible for selected bottles', () => {
    render(
      <CompareScreen
        items={[bottle('In stock A', 900), oosBottle as KioskProduct]}
        currency="NGN"
        onRemove={() => {}}
        onClose={() => {}}
      />
    );
    expect(screen.getAllByText('Out of stock')).toHaveLength(2);
    expect(document.querySelector('.kiosk-compare-oos')).toBeTruthy();
  });

});
