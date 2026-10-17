// @vitest-environment jsdom
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { arApService, type BatchMember } from '@/services/arAp.service';
import Form from './batch-form-modal';
vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { token: 'token' } } }),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const member: BatchMember = {
  key: 'source:journal:2200',
  origin: 'pos',
  account: '2200',
  number: 'RCP-1',
  name: 'Ada',
  method: 'wallet',
  date: '2026-10-14',
  capturedAmount: 60,
  refundedAmount: 10,
  amount: 50,
};
it('wallet selection sends net member identity and reviewed amounts', async () => {
  vi.spyOn(arApService, 'unbatched').mockResolvedValue({
    success: true,
    data: [member],
  });
  const save = vi
    .spyOn(arApService, 'createBatch')
    .mockResolvedValue({ success: true, data: {} } as Awaited<
      ReturnType<typeof arApService.createBatch>
    >);
  render(<Form side="customer" onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Reconciliation account'), {
    target: { value: '2200' },
  });
  const row = await screen.findByRole('checkbox', { name: /RCP-1/ });
  fireEvent.click(row);
  expect(screen.getByText(/1 selected/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Create batch' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        account: '2200',
        paymentIds: [member.key],
        expectedMembers: [
          {
            key: member.key,
            amount: 50,
            capturedAmount: 60,
            refundedAmount: 10,
          },
        ],
      })
    )
  );
});
it('picker failure is not an empty result and retry restores eligible payments', async () => {
  vi.spyOn(arApService, 'unbatched')
    .mockRejectedValueOnce(new Error('Connection closed'))
    .mockResolvedValue({ success: true, data: [member] });
  render(<Form side="customer" onClose={vi.fn()} onSaved={vi.fn()} />);
  await screen.findByRole('alert');
  expect(screen.queryByText(/No eligible payments/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry payments' }));
  await screen.findByRole('checkbox', { name: /RCP-1/ });
});
it('preserves earlier selections when a later page fails and retries that page', async () => {
  const cash = {
    ...member,
    key: 'source:cash:1000',
    account: '1000' as const,
    number: 'RCP-CASH',
    amount: 40,
    capturedAmount: 40,
    refundedAmount: 0,
  };
  vi.spyOn(arApService, 'unbatched')
    .mockResolvedValueOnce({
      success: true,
      data: [cash],
      pagination: { page: 1, pages: 2, total: 101, limit: 100 },
    })
    .mockRejectedValueOnce(new Error('Page two failed'))
    .mockResolvedValueOnce({
      success: true,
      data: [{ ...cash, key: 'source:cash2:1000', number: 'RCP-CASH-2' }],
      pagination: { page: 2, pages: 2, total: 101, limit: 100 },
    });
  render(<Form side="customer" onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: /RCP-CASH/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Load more payments' }));
  await screen.findByRole('alert');
  expect(screen.getByText(/1 selected/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry payments' }));
  await screen.findByRole('checkbox', { name: /RCP-CASH-2/ });
  expect(arApService.unbatched).toHaveBeenLastCalledWith(
    'token',
    'customer',
    expect.objectContaining({ page: 2 })
  );
  expect(screen.getByText(/1 selected/)).toBeTruthy();
});
it('changed selected amounts require clearing and reviewing the fresh amount before creation', async () => {
  let current = member;
  vi.spyOn(arApService, 'unbatched').mockImplementation(async () => ({
    success: true,
    data: [current],
  }));
  vi.spyOn(arApService, 'previewBatchSelection').mockImplementation(
    async () => ({ success: true, data: [current] })
  );
  const save = vi
    .spyOn(arApService, 'createBatch')
    .mockResolvedValue({ success: true, data: {} } as Awaited<
      ReturnType<typeof arApService.createBatch>
    >);
  render(<Form side="customer" onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Reconciliation account'), {
    target: { value: '2200' },
  });
  fireEvent.click(await screen.findByRole('checkbox', { name: /RCP-1/ }));
  current = { ...member, amount: 40, refundedAmount: 20 };
  fireEvent.click(screen.getByRole('button', { name: 'Refresh payments' }));
  await screen.findByText(/Selected payments changed/);
  expect(
    screen
      .getByRole('button', { name: 'Create batch' })
      .hasAttribute('disabled')
  ).toBe(true);
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Clear selections' }));
  fireEvent.click(screen.getByRole('checkbox', { name: /RCP-1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Create batch' }));
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        expectedMembers: [
          expect.objectContaining({ amount: 40, refundedAmount: 20 }),
        ],
      })
    )
  );
});
it('failed creation blocks another write until payments are refreshed', async () => {
  vi.spyOn(arApService, 'unbatched').mockResolvedValue({
    success: true,
    data: [member],
  });
  const save = vi
    .spyOn(arApService, 'createBatch')
    .mockRejectedValue(new Error('Action could not be confirmed'));
  render(<Form side="customer" onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(await screen.findByRole('checkbox', { name: /RCP-1/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Create batch' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Create batch' }));
  expect(save).toHaveBeenCalledTimes(1);
});

it('ignores a late Cash response after changing to Wallet', async () => {
  let resolve!: (value: { success: boolean; data: BatchMember[] }) => void;
  vi.spyOn(arApService, 'unbatched')
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    )
    .mockResolvedValue({ success: true, data: [member] });
  render(<Form side="customer" onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Reconciliation account'), {
    target: { value: '2200' },
  });
  await screen.findByRole('checkbox', { name: /RCP-1/ });
  await act(async () =>
    resolve({
      success: true,
      data: [{ ...member, number: 'STALE-CASH', account: '1000' }],
    })
  );
  expect(screen.queryByRole('checkbox', { name: /STALE-CASH/ })).toBeNull();
  expect(screen.getByRole('checkbox', { name: /RCP-1/ })).toBeTruthy();
});
