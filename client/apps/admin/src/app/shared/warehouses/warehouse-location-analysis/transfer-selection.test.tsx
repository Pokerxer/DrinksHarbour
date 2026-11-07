// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HistoryPanel from './history-panel';
import { getWarehouseHistory } from '@/services/warehouseHistory.service';
vi.mock('@/services/warehouseHistory.service', () => ({
  getWarehouseHistory: vi.fn(),
  getWarehouseHistoryProducts: vi.fn().mockResolvedValue([]),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function setup() {
  vi.mocked(getWarehouseHistory).mockImplementation(
    async (_id, _token, filters) => ({
      rows: [1, 2].map((n) => ({
        id: `row${filters.page}-${n}`,
        documentId: `t${filters.page}-${n}`,
        documentType: 'transfer' as const,
        reference: `T${filters.page}-${n}`,
        date: '2026-11-01',
        status: 'completed',
        description: 'Here to there',
        quantity: 3,
      })),
      pagination: { page: filters.page, limit: 2, total: 4, totalPages: 2 },
    })
  );
  render(<HistoryPanel warehouseId="here" token="jwt" tab="transfers" />);
}
it('retains selection across pages and page-select affects only that page', async () => {
  setup();
  fireEvent.click(await screen.findByLabelText('Select transfer T1-1'));
  fireEvent.click(screen.getByText('Next'));
  fireEvent.click(
    await screen.findByLabelText('Select all transfers on this page')
  );
  expect(screen.getByText('3 transfers selected')).toBeTruthy();
  fireEvent.click(screen.getByLabelText('Select all transfers on this page'));
  expect(screen.getByText('1 transfers selected')).toBeTruthy();
  fireEvent.click(screen.getByText('Previous'));
  expect(
    ((await screen.findByLabelText('Select transfer T1-1')) as HTMLInputElement)
      .checked
  ).toBe(true);
  fireEvent.click(screen.getByText('Clear selection'));
  expect(
    (screen.getByLabelText('Select transfer T1-1') as HTMLInputElement).checked
  ).toBe(false);
});
it('clears selection for filter changes and hides selection for movement mode', async () => {
  setup();
  fireEvent.click(await screen.findByLabelText('Select transfer T1-1'));
  fireEvent.change(screen.getByLabelText('Status'), {
    target: { value: 'completed' },
  });
  await waitFor(() =>
    expect(screen.getByText('0 transfers selected')).toBeTruthy()
  );
  fireEvent.click(await screen.findByLabelText('Select transfer T1-1'));
  fireEvent.change(screen.getByLabelText('Transfer history view'), {
    target: { value: 'transfer_movements' },
  });
  expect(screen.queryByText('Print selected transfers (PDF)')).toBeNull();
  expect(
    screen.queryByLabelText('Select all transfers on this page')
  ).toBeNull();
});
