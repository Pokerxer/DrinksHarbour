// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/services/merchant-order.service', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('@/services/merchant-order.service')
  >()),
  merchantRequest: state.request,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function summary() {
  const imported = await import('./sales-summary').catch(() => ({
    default: undefined,
  }));
  expect(imported.default).toBeTypeOf('function');
  const Summary = imported.default!;
  return render(<Summary token="signed" />);
}

test('renders tenant name, gross sales and paid order count', async () => {
  state.request.mockResolvedValue({
    tenant: { name: 'Wyn City', slug: 'wyncity' },
    marketplaceSalesTotal: 28500,
    marketplaceSalesOrders: 1,
  });
  summary();
  expect(await screen.findByText('Wyn City')).toBeTruthy();
  expect(screen.getByText('₦28,500')).toBeTruthy();
  expect(screen.getByText('1')).toBeTruthy();
  expect(state.request).toHaveBeenCalledWith('signed', '/sales-summary', 'GET');
});

test('malformed payloads render nothing instead of breaking the workspace', async () => {
  state.request.mockResolvedValue({ orders: [{ lines: [] }] });
  const { container } = await summary();
  await new Promise((r) => setTimeout(r, 0));
  expect(container.querySelector('section')).toBeNull();
});

test('a failed read renders nothing — the queue is never blocked by stats', async () => {
  state.request.mockRejectedValue(new Error('network down'));
  const { container } = await summary();
  await new Promise((r) => setTimeout(r, 0));
  expect(container.querySelector('section')).toBeNull();
});
