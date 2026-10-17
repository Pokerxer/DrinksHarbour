// @vitest-environment jsdom
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RemoveSizeButton from './RemoveSizeButton';

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: { user: { token: 'test-token' } } }) }));
vi.mock('./FormDialog', () => ({ default: ({ open, title, children, footer }: { open: boolean; title: string; children: React.ReactNode; footer: React.ReactNode }) => open ? <div role="dialog"><h2>{title}</h2>{children}{footer}</div> : null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('checks saved size history before allowing a confirmed removal', async () => {
  const remove = vi.fn();
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { allowed: true, reason: null } }) });
  vi.stubGlobal('fetch', fetcher);
  render(<RemoveSizeButton productId="product" sizeId="size" label="75cl" onRemove={remove} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove size 75cl' }));
  expect(remove).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remove size' }).hasAttribute('disabled')).toBe(false));
  expect(fetcher.mock.calls[0][0]).toContain('/product/sizes/size/deletion');
  fireEvent.click(screen.getByRole('button', { name: 'Remove size' }));
  expect(remove).toHaveBeenCalledOnce();
});

test.each(['history', 'network'])('keeps a saved size when blocked by %s', async kind => {
  const remove = vi.fn();
  vi.stubGlobal('fetch', kind === 'history'
    ? vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { allowed: false, reason: 'This size has sales history.' } }) })
    : vi.fn().mockRejectedValue(new Error('Unable to check history.')));
  render(<RemoveSizeButton productId="product" sizeId="size" label="75cl" onRemove={remove} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove size 75cl' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/history/));
  expect(screen.getByRole('button', { name: 'Remove size' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Keep size' }));
  expect(remove).not.toHaveBeenCalled();
});

test('unsaved sizes can be removed without requesting history', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  const remove = vi.fn();
  render(<RemoveSizeButton label="new variant" onRemove={remove} />);
  fireEvent.click(screen.getByRole('button', { name: 'Remove size new variant' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove size' }));
  expect(fetcher).not.toHaveBeenCalled();
  expect(remove).toHaveBeenCalledOnce();
});
