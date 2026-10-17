// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SalesEdit from './sales-edit';
import {
  salesOrderService,
  type SalesOrder,
} from '@/services/salesOrder.service';
const auth = vi.hoisted(() => ({ token: 'one', status: 'authenticated' }));
vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: auth.status,
    data: auth.token ? { user: { token: auth.token } } : null,
  }),
}));
vi.mock('./sales-nav-header', () => ({ default: () => null }));
vi.mock('./sales-create', () => ({
  default: ({
    initial,
    onUpdated,
  }: {
    initial: SalesOrder;
    onUpdated: (doc: SalesOrder) => void;
  }) => (
    <div>
      <p>
        {initial.soNumber} {initial.locked ? 'locked' : 'unlocked'}
      </p>
      <button onClick={() => onUpdated({ ...initial, locked: true })}>
        Apply locked response
      </button>
    </div>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  auth.token = 'one';
});
it('applies lifecycle responses and ignores late requests belonging to a previous session', async () => {
  let finish!: (value: { success: boolean; data: SalesOrder }) => void;
  vi.spyOn(salesOrderService, 'get').mockImplementation((_id, token) =>
    token === 'one'
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve({
          success: true,
          data: { _id: 'sale', soNumber: 'NEW' } as SalesOrder,
        }),
  );
  const { rerender } = render(<SalesEdit id="sale" />);
  auth.token = 'two';
  rerender(<SalesEdit id="sale" />);
  await screen.findByText('NEW unlocked');
  await act(async () => {
    finish({
      success: true,
      data: { _id: 'sale', soNumber: 'OLD' } as SalesOrder,
    });
  });
  expect(screen.queryByText(/OLD/)).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: 'Apply locked response' }),
  );
  expect(screen.getByText('NEW locked')).toBeTruthy();
});
it('signed-out editing terminates loading without a request', () => {
  auth.token = '';
  const get = vi.spyOn(salesOrderService, 'get');
  render(<SalesEdit id="sale" />);
  expect(screen.getByText(/Sign in to edit/)).toBeTruthy();
  expect(get).not.toHaveBeenCalled();
});
it('failed reads expose retry and do not leave an editable stale document', async () => {
  vi.spyOn(salesOrderService, 'get')
    .mockRejectedValueOnce(new Error('Temporarily unavailable'))
    .mockResolvedValue({
      success: true,
      data: { _id: 'sale', soNumber: 'RECOVERED' } as SalesOrder,
    });
  render(<SalesEdit id="sale" />);
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain(
      'Temporarily unavailable',
    ),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('RECOVERED unlocked');
});
