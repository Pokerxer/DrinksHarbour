// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import HistoryPanel from './history-panel';
import { getWarehouseHistory } from '@/services/warehouseHistory.service';
import { historyLink, movementQuantity } from './history-table';
vi.mock('@/services/warehouseHistory.service', () => ({
  getWarehouseHistory: vi.fn(),
  getWarehouseHistoryProducts: vi.fn().mockResolvedValue([
    { id: 'p', label: 'Wine · W1' },
    { id: 'p2', label: 'Beer · B1' },
  ]),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('combines product/date filters, resets paging and retains warehouse scope', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 30, totalPages: 2 },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="purchases" />);
  fireEvent.focus(screen.getByLabelText('Search products'));
  await screen.findByRole('checkbox', { name: 'Wine · W1' });
  expect(screen.queryByRole('checkbox', { name: 'Other wine' })).toBeNull();
  await screen.findByText(/No records match/);
  fireEvent.click(screen.getByText('Next'));
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ page: 2 }),
    ),
  );
  fireEvent.focus(screen.getByLabelText('Search products'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Wine · W1' }));
  fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-10-03' } });
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith('here', 'jwt', {
      kind: 'purchases',
      product: 'p',
      start: '2026-10-01',
      end: '2026-10-03',
      page: 1,
    }),
  );
  fireEvent.click(screen.getByText('Clear filters'));
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith('here', 'jwt', {
      kind: 'purchases',
      product: '',
      start: '',
      end: '',
      page: 1,
    }),
  );
});
it('opens transfer documents by default and allows movement history', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="transfers" />);
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ kind: 'transfers' }),
    ),
  );
  fireEvent.change(screen.getByLabelText('Transfer history view'), {
    target: { value: 'transfer_movements' },
  });
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ kind: 'transfer_movements', page: 1 }),
    ),
  );
});
it('shows an error and retries instead of showing an empty successful history', async () => {
  vi.mocked(getWarehouseHistory)
    .mockRejectedValueOnce(new Error('History unavailable'))
    .mockResolvedValue({ rows: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="movements" />);
  expect((await screen.findByRole('alert')).textContent).toContain('History unavailable');
  fireEvent.click(screen.getByText('Retry'));
  await screen.findByText(/No records match/);
});
it('links source documents and signs outgoing stock changes', () => {
  const row = {
    id: 'r',
    documentId: 'abc',
    documentType: 'purchase' as const,
    reference: 'PO1',
    date: '',
    status: 'transfer_out',
    description: 'Wine',
    quantity: 4,
  };
  expect(historyLink(row)).toBe('/purchases/abc');
  expect(historyLink({ ...row, documentType: 'transfer' })).toBe('/purchases/transfers/abc');
  expect(historyLink({ ...row, documentType: 'product' })).toBe('/warehouses/product/abc');
  expect(movementQuantity(row)).toBe(-4);
  expect(movementQuantity({ ...row, status: 'returned' })).toBe(4);
  expect(movementQuantity({ ...row, status: 'adjusted', quantity: 7 })).toBeNull();
  expect(movementQuantity({ ...row, status: 'adjusted', quantity: 7, stockChange: -2 })).toBe(-2);
});
it('applies date shortcuts and prevents invalid date ranges from making requests', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="movements" />);
  await screen.findByText(/No records match/);
  fireEvent.click(screen.getByText('This month'));
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({
        start: new Date().toISOString().slice(0, 7) + '-01',
        end: new Date().toISOString().slice(0, 10),
        page: 1,
      }),
    ),
  );
  fireEvent.change(screen.getByLabelText('Created from'), { target: { value: '2026-11-03' } });
  fireEvent.change(screen.getByLabelText('Created to'), { target: { value: '2026-10-01' } });
  expect((await screen.findByRole('alert')).textContent).toContain('Choose an end date');
  expect(
    vi
      .mocked(getWarehouseHistory)
      .mock.calls.some(
        ([, , filters]) => filters.start === '2026-11-03' && filters.end === '2026-10-01',
      ),
  ).toBe(false);
});
it('ignores a stale history response when filters change', async () => {
  let finish!: (data: Awaited<ReturnType<typeof getWarehouseHistory>>) => void;
  vi.mocked(getWarehouseHistory)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    )
    .mockResolvedValue({ rows: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="movements" />);
  fireEvent.focus(screen.getByLabelText('Search products'));
  await screen.findByRole('checkbox', { name: 'Wine · W1' });
  fireEvent.focus(screen.getByLabelText('Search products'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Wine · W1' }));
  await screen.findByText(/No records match/);
  finish({
    rows: [
      {
        id: 'old',
        documentId: 'old',
        documentType: 'product',
        reference: 'Old reference',
        description: 'Stale wine',
        date: '2026-10-01',
        status: 'received',
        quantity: 10,
      },
    ],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  await waitFor(() => expect(screen.queryByText('Stale wine')).toBeNull());
});
it('combines multiple products with status and reference, removes one chip, and clears all', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="purchases" />);
  fireEvent.focus(screen.getByLabelText('Search products'));
  await screen.findByRole('checkbox', { name: 'Wine · W1' });
  fireEvent.focus(screen.getByLabelText('Search products'));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Wine · W1' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Beer · B1' }));
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'received' } });
  fireEvent.change(screen.getByLabelText('Search reference or supplier'), {
    target: { value: 'PO(1)' },
  });
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ product: 'p,p2', status: 'received', search: 'PO(1)', page: 1 }),
    ),
  );
  fireEvent.click(screen.getByLabelText('Remove Wine · W1'));
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ product: 'p2', status: 'received' }),
    ),
  );
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'B1' } });
  expect(screen.queryByRole('checkbox', { name: 'Wine · W1' })).toBeNull();
  expect(screen.getByRole('checkbox', { name: 'Beer · B1' })).toBeTruthy();
  fireEvent.click(screen.getByText('Clear filters'));
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith('here', 'jwt', {
      kind: 'purchases',
      product: '',
      start: '',
      end: '',
      page: 1,
    }),
  );
});
it('resets incompatible status when changing transfer history kind', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="transfers" />);
  await screen.findByText(/No records match/);
  fireEvent.change(screen.getByLabelText('Transfer history view'), {
    target: { value: 'transfer_movements' },
  });
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'transfer_out' } });
  fireEvent.change(screen.getByLabelText('Transfer history view'), {
    target: { value: 'transfers' },
  });
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ kind: 'transfers', status: '', page: 1 }),
    ),
  );
});
it('clears product option search even when no products were selected', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="purchases" />);
  fireEvent.focus(screen.getByLabelText('Search products'));
  await screen.findByRole('checkbox', { name: 'Wine · W1' });
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'no match' } });
  expect(screen.queryByRole('checkbox', { name: 'Wine · W1' })).toBeNull();
  fireEvent.click(screen.getByText('Clear filters'));
  await waitFor(() =>
    expect((screen.getByLabelText('Search products') as HTMLInputElement).value).toBe(''),
  );
  fireEvent.focus(screen.getByLabelText('Search products'));
  expect(screen.getByRole('checkbox', { name: 'Wine · W1' })).toBeTruthy();
});
it('keeps aggregate purchase totals visible across history pages', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 30, totalPages: 2 },
    purchaseTotals: {
      currencies: [
        {
          currency: 'NGN',
          receivedQuantity: 30,
          returnedQuantity: 4,
          netReceivedQuantity: 26,
          receivedValue: 3000,
          returnedValue: 400,
          netReceivedValue: 2600,
        },
      ],
    },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="purchases" />);
  expect(
    (await screen.findByRole('table', { name: 'All matching purchases' })).textContent,
  ).toContain('26 units');
  fireEvent.click(screen.getByText('Next'));
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ kind: 'purchases', page: 2 }),
    ),
  );
  expect(
    (await screen.findByRole('table', { name: 'All matching purchases' })).textContent,
  ).toContain('NGN 2,600.00');
});
it('shows all-page stock movement totals and resets paging when page size changes', async () => {
  vi.mocked(getWarehouseHistory).mockResolvedValue({
    rows: [],
    pagination: { page: 1, limit: 20, total: 35, totalPages: 2 },
    movementTotals: {
      incomingQuantity: 100,
      outgoingQuantity: 30,
      netQuantity: 70,
      records: 35,
      unknownChanges: 1,
    },
  });
  render(<HistoryPanel warehouseId="here" token="jwt" tab="movements" />);
  const totals = await screen.findByRole('region', { name: 'Stock movement totals' });
  expect(totals.textContent).toContain('100 units');
  expect(totals.textContent).toContain('70 units');
  expect(totals.textContent).toContain('1');
  fireEvent.click(screen.getByText('Next'));
  fireEvent.change(await screen.findByLabelText('Rows per page'), { target: { value: '50' } });
  await waitFor(() =>
    expect(getWarehouseHistory).toHaveBeenLastCalledWith(
      'here',
      'jwt',
      expect.objectContaining({ page: 1, limit: 50, kind: 'movements' }),
    ),
  );
});
