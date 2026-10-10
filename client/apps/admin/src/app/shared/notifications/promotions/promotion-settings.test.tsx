// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PromotionSettings from './promotion-settings';
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it('requires a calendar date when a special day is named', () => {
  const apply = vi.fn();
  const { container } = render(
    <PromotionSettings canPrice apply={apply} disabled={false} />
  );
  fireEvent.change(screen.getByLabelText('Special day name'), {
    target: { value: 'Anniversary' },
  });
  fireEvent.submit(container.querySelector('form')!);
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(apply).not.toHaveBeenCalled();
});
it('cannot reset applied settings while a refresh is loading', () => {
  const apply = vi.fn();
  render(<PromotionSettings canPrice apply={apply} disabled />);
  fireEvent.click(screen.getByRole('button', { name: 'Reset settings' }));
  expect(apply).not.toHaveBeenCalled();
});
