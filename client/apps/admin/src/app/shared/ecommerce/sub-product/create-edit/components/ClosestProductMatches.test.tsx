// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClosestProductMatches from './ClosestProductMatches';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const response = (products: object[]) => ({
  ok: true,
  json: async () => ({ data: { products } }),
});
async function debounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300);
  });
}

describe('closest catalog matches while naming a product', () => {
  it('shows the closest identity, uses authenticated smart search and only selects on explicit click', async () => {
    const fetcher = vi.fn().mockResolvedValue(
      response([
        {
          _id: 'blue',
          name: 'Johnnie Walker Blue Label',
          matchReason: 'Similar name',
          matchKind: 'close',
          status: 'pending',
        },
        {
          _id: 'red',
          name: 'Johnnie Walker Red Label',
          matchReason: 'Partially matching name',
          matchKind: 'related',
        },
      ])
    );
    vi.stubGlobal('fetch', fetcher);
    const select = vi.fn();
    render(
      <ClosestProductMatches
        name="johnie walker blue"
        token="staff-token"
        onSelect={select}
      />
    );
    await debounce();
    expect(String(fetcher.mock.calls[0][0])).toContain('matchMode=smart');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer staff-token'
    );
    expect(screen.getByText('Closest match')).toBeDefined();
    expect(screen.getByText('Pending approval')).toBeDefined();
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Use Johnnie Walker Blue Label' })
    );
    expect(select).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'blue' })
    );
  });

  it('cancels an old name immediately and ignores a late response before the next debounce', async () => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          })
      )
      .mockResolvedValueOnce(
        response([{ _id: 'moet', name: 'Moët & Chandon' }])
      );
    vi.stubGlobal('fetch', fetcher);
    const props = { token: 'staff-token', onSelect: vi.fn() };
    const view = render(<ClosestProductMatches {...props} name="johnnie" />);
    await debounce();
    view.rerender(<ClosestProductMatches {...props} name="moet" />);
    expect(fetcher.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => {
      resolveOld(response([{ _id: 'old', name: 'Old result' }]));
    });
    expect(screen.queryByText('Old result')).toBeNull();
    await debounce();
    expect(screen.getByText('Moët & Chandon')).toBeDefined();
  });

  it('distinguishes search failure from no match and retries without changing the new name', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetcher);
    render(
      <ClosestProductMatches
        name="New drink"
        token="staff-token"
        onSelect={vi.fn()}
      />
    );
    await debounce();
    expect(screen.getByRole('alert').textContent).toContain('Could not check');
    expect(screen.queryByText('No close catalog matches found.')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', { name: 'Retry catalog search' })
    );
    await debounce();
    expect(screen.getByText('No close catalog matches found.')).toBeDefined();
  });

  it('clears suggestions when the name is cleared and waits for authentication', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(response([{ _id: 'p', name: 'Product' }]));
    vi.stubGlobal('fetch', fetcher);
    const props = { onSelect: vi.fn() };
    const view = render(<ClosestProductMatches {...props} name="Product" />);
    await debounce();
    expect(fetcher).not.toHaveBeenCalled();
    view.rerender(
      <ClosestProductMatches {...props} token="staff-token" name="Product" />
    );
    await debounce();
    expect(screen.getByText('Product')).toBeDefined();
    view.rerender(
      <ClosestProductMatches {...props} token="staff-token" name="" />
    );
    expect(screen.queryByText('Product')).toBeNull();
  });
});
