// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PromotionSettings from './promotion-settings';
const occasions = [
  {
    name: 'Champagne Day',
    date: '2026-10-23',
    daysAway: 13,
    kind: 'drinks',
    family: 'champagne',
    sourceUrl: 'https://www.champagneday.fr/world/',
  },
];
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('selects a world drinks event with its verified date and source, and permits a custom calendar date', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  const apply = vi.fn();
  render(
    <PromotionSettings
      canPrice
      apply={apply}
      disabled={false}
      occasions={occasions}
    />
  );
  fireEvent.change(screen.getByLabelText('World drinks event'), {
    target: { value: 'Champagne Day|2026-10-23' },
  });
  expect(
    (screen.getByLabelText('Special day name') as HTMLInputElement).value
  ).toBe('Champagne Day');
  expect(
    screen.getByRole('button', { name: 'Special day date' }).textContent
  ).toContain('23 October 2026');
  expect(
    screen.getByRole('link', { name: 'Event source' }).getAttribute('href')
  ).toBe('https://www.champagneday.fr/world/');
  fireEvent.click(screen.getByRole('button', { name: 'Apply offer settings' }));
  expect(apply).toHaveBeenCalledWith({
    maxDiscount: '10',
    marginFloor: '20',
    eventName: 'Champagne Day',
    eventDate: '2026-10-23',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Special day date' }));
  fireEvent.click(screen.getByRole('option', { name: /October 24th, 2026/ }));
  expect(screen.queryByRole('link', { name: 'Event source' })).toBeNull();
});
it('loading prevents selecting a world event', () => {
  render(
    <PromotionSettings
      canPrice
      apply={() => {}}
      disabled
      occasions={occasions}
    />
  );
  expect(
    (screen.getByLabelText('World drinks event') as HTMLSelectElement).disabled
  ).toBe(true);
});
