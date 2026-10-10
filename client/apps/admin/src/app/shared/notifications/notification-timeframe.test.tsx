// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NotificationTimeframe from './notification-timeframe';
afterEach(cleanup);
it('applies both endpoints together, rejects reversed dates and resets', () => {
  const apply = vi.fn();
  render(<NotificationTimeframe startDate="" endDate="" onApply={apply} />);
  fireEvent.change(screen.getByLabelText('From date'), {
    target: { value: '2026-09-30' },
  });
  fireEvent.change(screen.getByLabelText('To date'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply timeframe' }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('To date'), {
    target: { value: '2026-09-30' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply timeframe' }));
  expect(apply).toHaveBeenCalledWith('2026-09-30', '2026-09-30');
});
