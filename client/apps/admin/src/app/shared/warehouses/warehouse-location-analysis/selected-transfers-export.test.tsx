// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SelectedTransfersExport from './selected-transfers-export';
import { stockTransferService } from '@/services/stockTransfer.service';
import { requestDocumentExport } from '@/utils/print/document-export';
vi.mock('@/services/stockTransfer.service', () => ({
  stockTransferService: { get: vi.fn() },
}));
vi.mock('@/utils/print/document-export', () => ({
  requestDocumentExport: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const props = {
  warehouseId: 'here',
  token: 'jwt',
  selected: ['T1', 'T2'],
  clear: vi.fn(),
};
const doc = (id: string) => ({
  success: true,
  data: {
    _id: id,
    transferNumber: id,
    status: 'completed' as const,
    sourceWarehouse: 'here',
    destinationWarehouse: 'there',
    total: 10,
    items: [
      {
        subProductId: 'wine',
        subProductName: 'Wine',
        sku: 'W',
        quantity: 1,
        transferredQty: 1,
        costPrice: 10,
      },
    ],
  },
});
it('fetches complete selected documents and opens one combined PDF export', async () => {
  vi.mocked(stockTransferService.get).mockImplementation(async (id) => doc(id));
  render(<SelectedTransfersExport {...props} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Print selected transfers (PDF)' })
  );
  await waitFor(() => expect(requestDocumentExport).toHaveBeenCalledTimes(1));
  expect(stockTransferService.get).toHaveBeenCalledWith('T1', 'jwt');
  expect(stockTransferService.get).toHaveBeenCalledWith('T2', 'jwt');
  expect(vi.mocked(requestDocumentExport).mock.calls[0][0]).toMatchObject({
    table: {
      rows: [
        [
          expect.anything(),
          expect.anything(),
          expect.anything(),
          { text: '2' },
          expect.anything(),
          { text: '20.00' },
          { text: '0.00' },
        ],
      ],
    },
  });
});
it('shows a fetch failure without exporting a partial report and allows retry', async () => {
  vi.mocked(stockTransferService.get)
    .mockRejectedValueOnce(new Error('Permission denied'))
    .mockImplementation(async (id) => doc(id));
  render(<SelectedTransfersExport {...props} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Print selected transfers (PDF)' })
  );
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Permission denied'
  );
  expect(requestDocumentExport).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', { name: 'Print selected transfers (PDF)' })
  );
  await waitFor(() => expect(requestDocumentExport).toHaveBeenCalledTimes(1));
});
it('disables export for an empty selection', () => {
  render(<SelectedTransfersExport {...props} selected={[]} />);
  expect(
    (
      screen.getByRole('button', {
        name: 'Print selected transfers (PDF)',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});

it('does not open a stale PDF after leaving the transfer view', async () => {
  let finish!: (value: ReturnType<typeof doc>) => void;
  vi.mocked(stockTransferService.get).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    })
  );
  const view = render(<SelectedTransfersExport {...props} selected={['T1']} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Print selected transfers (PDF)' })
  );
  view.unmount();
  finish(doc('T1'));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(requestDocumentExport).not.toHaveBeenCalled();
});
