// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import InventoryCountPanel from './inventory-count-panel';
const { createCount } = vi.hoisted(() => ({ createCount: vi.fn() }));
vi.mock('@/services/venue/costing', () => ({ createCount, completeCount: vi.fn(), getUsageVariance: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('retries an uncertain count capture with the same command identity', async () => {
  createCount.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValue({ id: 'count-1', version: 0, completeness: 'incomplete' });
  render(<InventoryCountPanel token="owner" locationId="location" catalog={[{ id: 'rice', name: 'Rice', sizes: [{ id: 'bag', name: 'Bag' }] }]} />);
  fireEvent.change(screen.getByLabelText('Stock item'), { target: { value: 'rice' } });
  fireEvent.change(screen.getByLabelText('Stock form'), { target: { value: 'bag' } });
  fireEvent.change(screen.getByLabelText('Observed whole units'), { target: { value: '0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Capture count' }));
  await screen.findByRole('alert');
  const first = createCount.mock.calls[0][2];
  fireEvent.click(screen.getByRole('button', { name: 'Capture count' }));
  await screen.findByText('count-1');
  expect(createCount.mock.calls[1][2]).toEqual(first);
  expect(first.items[0].quantity).toEqual({ amountScaled: 0, scale: 1, unit: 'count' });
});
