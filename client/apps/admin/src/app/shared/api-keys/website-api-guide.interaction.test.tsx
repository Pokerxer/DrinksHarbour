// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import WebsiteApiGuide from './website-api-guide';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test('documentation switches examples and copies the selected server-side request', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(<WebsiteApiGuide />);
  fireEvent.click(screen.getByRole('button', { name: 'Checkout example' }));
  expect(
    screen.getByText(/const response = await fetch.*checkout/s).textContent
  ).toContain('Idempotency-Key');
  fireEvent.click(screen.getByRole('button', { name: 'Copy example' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Copied.')
  );
  expect(writeText.mock.calls[0][0]).toContain("'/checkout'");
  expect(writeText.mock.calls[0][0]).toContain('DRINKSHARBOUR_API_KEY');
  fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  expect(writeText.mock.calls[1][0]).toMatch(/\/api\/integrations\/v1$/);
});

test('unavailable clipboard provides an accessible manual-copy fallback', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: undefined,
  });
  render(<WebsiteApiGuide />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy URL' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('copy it manually')
  );
});
