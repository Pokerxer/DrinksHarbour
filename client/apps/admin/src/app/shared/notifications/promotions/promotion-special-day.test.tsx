// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PromotionSettings from './promotion-settings';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('uses a calendar with disabled past dates and applies the chosen calendar day', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T23:30:00Z'));
  const apply = vi.fn();
  render(<PromotionSettings canPrice apply={apply} disabled={false} />);
  fireEvent.change(screen.getByLabelText('Special day name'), {
    target: { value: 'Anniversary' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Special day date' }));
  const calendar = screen.getByRole('dialog', { name: 'Choose Date' });
  const past = within(calendar).getByRole('option', {
    name: /October 10th, 2026/,
  });
  expect(past.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(past);
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(
    within(calendar).getByRole('option', { name: /October 20th, 2026/ })
  );
  expect(
    screen.getByRole('button', { name: 'Special day date' }).textContent
  ).toContain('20 October 2026');
  fireEvent.click(screen.getByRole('button', { name: 'Special day date' }));
  fireEvent.click(screen.getByRole('option', { name: /October 21st, 2026/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply offer settings' }));
  expect(apply).toHaveBeenCalledWith({
    maxDiscount: '10',
    marginFloor: '20',
    eventName: 'Anniversary',
    eventDate: '2026-10-21',
  });
});
it('calendar navigates to the final month, disables day 61 and clears both special-day fields', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T23:30:00Z'));
  const apply = vi.fn();
  render(<PromotionSettings canPrice apply={apply} disabled={false} />);
  fireEvent.change(screen.getByLabelText('Special day name'), {
    target: { value: 'Anniversary' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Special day date' }));
  fireEvent.click(screen.getByRole('button', { name: /Next Month/ }));
  fireEvent.click(screen.getByRole('button', { name: /Next Month/ }));
  const calendar = screen.getByRole('dialog', { name: 'Choose Date' });
  expect(
    within(calendar)
      .getByRole('option', { name: /December 11th, 2026/ })
      .getAttribute('aria-disabled')
  ).toBe('true');
  fireEvent.click(
    within(calendar).getByRole('option', { name: /December 10th, 2026/ })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Clear special day' }));
  expect(
    (screen.getByLabelText('Special day name') as HTMLInputElement).value
  ).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Apply offer settings' }));
  expect(apply).toHaveBeenCalledWith({
    maxDiscount: '10',
    marginFloor: '20',
    eventName: '',
    eventDate: '',
  });
});

it('disables calendar and clearing while suggestions load', () => {
  const { rerender } = render(
    <PromotionSettings canPrice apply={() => {}} disabled={false} />
  );
  fireEvent.change(screen.getByLabelText('Special day name'), {
    target: { value: 'Anniversary' },
  });
  rerender(<PromotionSettings canPrice apply={() => {}} disabled />);
  fireEvent.click(screen.getByRole('button', { name: 'Special day date' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Clear special day' }));
  expect(
    (screen.getByLabelText('Special day name') as HTMLInputElement).value
  ).toBe('Anniversary');
});
