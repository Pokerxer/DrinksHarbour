// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { subproductService } from '@/services/subproduct.service';
import ReviewSubProductModal from './ReviewSubProductModal';
vi.mock('@/services/subproduct.service', () => ({
  subproductService: { getSubProduct: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const listing = {
  _id: 'sp',
  status: 'pending',
  sku: 'SKU-1',
  tenant: { name: 'Shop A', revenueModel: 'markup', markupPercentage: 25 },
  product: { name: 'Glenfiddich 15', platformMarkup: 15 },
  pricing: {
    costPrice: 1000,
    tenantSellingPrice: 2000,
    platformCostPrice: 1250,
    platformSellingPrice: 1500,
    platformMarkupPct: 15,
    tenantReceives: 1000,
  },
};
const response = (value = listing) => ({ data: { subProduct: value } });
const props = () => ({
  subProductId: 'sp',
  token: 'token',
  onClose: vi.fn(),
  onApprove: vi.fn().mockResolvedValue(undefined),
  onDecline: vi.fn().mockResolvedValue(undefined),
});
it('keeps edited prices until closing is explicitly confirmed', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  fireEvent.change(await screen.findByLabelText('Website price for Base listing'), {
    target: { value: '1700' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close sub-product review' }));
  expect(p.onClose).not.toHaveBeenCalled();
  expect(
    screen.getByRole('region', { name: 'Unsaved review changes' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(
    (screen.getByLabelText('Website price for Base listing') as HTMLInputElement)
      .value
  ).toBe('1700');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Discard edits and close' }));
  expect(p.onClose).toHaveBeenCalledOnce();
});
it('only reloads edited prices after an explicit discard and leaves clean closes immediate', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  fireEvent.change(await screen.findByLabelText('Website price for Base listing'), {
    target: { value: '1700' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reload listing details' }));
  expect(subproductService.getSubProduct).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Discard edits and reload' }));
  await waitFor(() =>
    expect(subproductService.getSubProduct).toHaveBeenCalledTimes(2)
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText('Website price for Base listing') as HTMLInputElement)
        .value
    ).toBe('1500')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Close sub-product review' }));
  expect(p.onClose).toHaveBeenCalledOnce();
});
it('protects browser refresh only while there are unsaved review edits', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  render(<ReviewSubProductModal {...props()} />);
  const input = await screen.findByLabelText('Website price for Base listing');
  const before = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(before);
  expect(before.defaultPrevented).toBe(false);
  fireEvent.change(input, { target: { value: '1700' } });
  const dirty = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(dirty);
  expect(dirty.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Reset price edits' }));
  const reset = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(reset);
  expect(reset.defaultPrevented).toBe(false);
});
it('focuses Keep editing and lets Escape cancel the discard choice', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  fireEvent.change(await screen.findByLabelText('Website price for Base listing'), {
    target: { value: '1700' },
  });
  const close = screen.getByRole('button', { name: 'Close sub-product review' });
  close.focus();
  fireEvent.click(close);
  const keep = screen.getByRole('button', { name: 'Keep editing' });
  expect(document.activeElement).toBe(keep);
  fireEvent.keyDown(keep, { key: 'Escape' });
  expect(
    screen.queryByRole('region', { name: 'Unsaved review changes' })
  ).toBeNull();
  expect(document.activeElement).toBe(close);
  expect(p.onClose).not.toHaveBeenCalled();
});
it('protects unsent decline feedback even with unchanged prices', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  await screen.findByText('Base listing');
  fireEvent.click(screen.getByRole('button', { name: 'Decline listing' }));
  fireEvent.change(screen.getByLabelText('Decline reason'), {
    target: { value: 'Please check this bottle size.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close sub-product review' }));
  expect(screen.getByText(/Your decline feedback has not been sent/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(
    (screen.getByLabelText('Decline reason') as HTMLTextAreaElement).value
  ).toBe('Please check this bottle size.');
  expect(p.onDecline).not.toHaveBeenCalled();
});
it('removes refresh protection on unmount and prevents dismissal during approval', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  let finish!: () => void;
  const p = props();
  p.onApprove.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { unmount } = render(<ReviewSubProductModal {...p} />);
  fireEvent.change(await screen.findByLabelText('Website price for Base listing'), {
    target: { value: '1700' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Approve listing' }));
  expect(
    (
      screen.getByRole('button', {
        name: 'Close sub-product review',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(
    screen.queryByRole('region', { name: 'Unsaved review changes' })
  ).toBeNull();
  finish();
  await waitFor(() => expect(p.onClose).toHaveBeenCalledOnce());
  unmount();
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);
});
it('returns keyboard focus to the review when its footer button was replaced by the prompt', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  render(<ReviewSubProductModal {...props()} />);
  fireEvent.change(await screen.findByLabelText('Website price for Base listing'), {
    target: { value: '1700' },
  });
  const close = screen.getByRole('button', { name: 'Close' });
  close.focus();
  fireEvent.click(close);
  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  expect(document.activeElement).toBe(screen.getByRole('main'));
});
