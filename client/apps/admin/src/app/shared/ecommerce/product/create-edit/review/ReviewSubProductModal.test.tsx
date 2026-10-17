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
it('uses full-viewport accessible dialog and adjustable existing targets; suggestions remain drafts until approval', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  await screen.findByText('Base listing');
  expect(screen.getByRole('dialog', { name: 'Review Sub-Product' })).toBeTruthy();
  expect(screen.getAllByText('₦250.00').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText('Margin targets'));
  fireEvent.change(screen.getByLabelText('Platform target margin (%)'), {
    target: { value: '20' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Use suggested price for Base listing' })
  );
  expect(
    (screen.getByLabelText('Website price for Base listing') as HTMLInputElement)
      .value
  ).toBe('1600');
  expect(p.onApprove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Approve listing' }));
  await waitFor(() =>
    expect(p.onApprove).toHaveBeenCalledWith('sp', { baseWebsitePrice: 1600 })
  );
  expect(p.onClose).toHaveBeenCalledOnce();
});
it('keeps the modal open and explains approval failures; decline failure remains editable', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  const p = props();
  p.onApprove.mockRejectedValue(new Error('Price changed on server'));
  p.onDecline.mockRejectedValue(new Error('Unable to decline'));
  render(<ReviewSubProductModal {...p} />);
  await screen.findByText('Base listing');
  fireEvent.click(screen.getByRole('button', { name: 'Approve listing' }));
  await screen.findByText('Price changed on server');
  expect(p.onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Decline listing' }));
  fireEvent.change(screen.getByLabelText('Decline reason'), {
    target: { value: 'Check the pricing' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm decline' }));
  await screen.findByText('Unable to decline');
  expect(p.onDecline).toHaveBeenCalledWith('sp', 'Check the pricing');
  expect(p.onClose).not.toHaveBeenCalled();
});
it('blocks below-payout or malformed prices and does not send unchanged prices as overrides', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue(response());
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  await screen.findByText('Base listing');
  fireEvent.change(screen.getByLabelText('Website price for Base listing'), {
    target: { value: '1000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Approve listing' }));
  expect(p.onApprove).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Website price for Base listing'), {
    target: { value: '1500' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Approve listing' }));
  await waitFor(() => expect(p.onApprove).toHaveBeenCalledWith('sp', {}));
});
it('retries load errors and hides stale listing data on record changes', async () => {
  vi.mocked(subproductService.getSubProduct)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce(response());
  const p = props();
  const { rerender } = render(<ReviewSubProductModal {...p} />);
  await screen.findByText('Offline');
  fireEvent.click(screen.getByRole('button', { name: 'Retry listing details' }));
  await screen.findByText('Base listing');
  let finish!: (r: unknown) => void;
  vi.mocked(subproductService.getSubProduct).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  rerender(<ReviewSubProductModal {...p} subProductId="other" />);
  await screen.findByText('Loading listing details…');
  expect(screen.queryByText('Glenfiddich 15')).toBeNull();
  finish(response());
  await screen.findByText('The server returned invalid listing details.');
  expect(p.onApprove).not.toHaveBeenCalled();
});
it('searches sizes, preserves manual edits when applying suggestions, and resets edits', async () => {
  const sized = {
    ...listing,
    sizes: [
      { _id: 'a', displayName: '70cl', sku: 'GLEN-A', pricing: listing.pricing },
      { _id: 'b', displayName: '1 litre', sku: 'GLEN-B', pricing: listing.pricing },
    ],
  };
  vi.mocked(subproductService.getSubProduct).mockResolvedValue({
    data: { subProduct: sized },
  });
  render(<ReviewSubProductModal {...props()} />);
  await screen.findByLabelText('Website price for 70cl');
  fireEvent.change(screen.getByLabelText('Website price for 70cl'), {
    target: { value: '1700' },
  });
  fireEvent.click(screen.getByText('Margin targets'));
  fireEvent.change(screen.getByLabelText('Platform target margin (%)'), {
    target: { value: '20' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Apply suggestions to unchanged prices' })
  );
  expect(
    (screen.getByLabelText('Website price for 70cl') as HTMLInputElement).value
  ).toBe('1700');
  expect(
    (screen.getByLabelText('Website price for 1 litre') as HTMLInputElement).value
  ).toBe('1600');
  fireEvent.change(screen.getByLabelText('Search sizes'), {
    target: { value: 'GLEN-B' },
  });
  expect(screen.queryByLabelText('Website price for 70cl')).toBeNull();
  expect(screen.getByLabelText('Website price for 1 litre')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Reset price edits' }));
  expect(
    (screen.getByLabelText('Website price for 1 litre') as HTMLInputElement).value
  ).toBe('1500');
});
it('explains hidden blocking prices from any tab and navigates directly to the issues', async () => {
  const sized = {
    ...listing,
    sizes: [
      { _id: 'a', displayName: '70cl', pricing: listing.pricing },
      { _id: 'b', displayName: '1 litre', pricing: listing.pricing },
    ],
  };
  vi.mocked(subproductService.getSubProduct).mockResolvedValue({
    data: { subProduct: sized },
  });
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  fireEvent.change(await screen.findByLabelText('Website price for 1 litre'), {
    target: { value: '1000' },
  });
  fireEvent.change(screen.getByLabelText('Search sizes'), {
    target: { value: '70cl' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
  expect(
    (screen.getByRole('button', { name: 'Approve listing' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(screen.getByText(/1 price issue blocks approval/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Show blocking prices' }));
  expect(screen.getByLabelText('Website price for 1 litre')).toBeTruthy();
  expect(screen.queryByLabelText('Website price for 70cl')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reset price for 1 litre' }));
  expect(
    (screen.getByRole('button', { name: 'Approve listing' }) as HTMLButtonElement)
      .disabled
  ).toBe(false);
  expect(p.onApprove).not.toHaveBeenCalled();
});
it('locks commission to the agreement and previews the tenant share when the customer price changes', async () => {
  vi.mocked(subproductService.getSubProduct).mockResolvedValue({
    data: {
      subProduct: {
        ...listing,
        tenant: {
          name: 'Shop A',
          revenueModel: 'commission',
          commissionPercentage: 13,
        },
        pricing: {
          costPrice: 6000,
          tenantSellingPrice: 10000,
          platformCostPrice: 8700,
          platformSellingPrice: 10000,
          commissionPct: 13,
          revenueModel: 'commission',
        },
      },
    },
  });
  const p = props();
  render(<ReviewSubProductModal {...p} />);
  fireEvent.change(await screen.findByLabelText('Website price for Base listing'), {
    target: { value: '9000' },
  });
  expect(screen.getByText('₦7,830.00')).toBeTruthy();
  expect(screen.getByText('₦1,170.00')).toBeTruthy();
  fireEvent.click(screen.getByText('Margin targets'));
  const rate = screen.getByLabelText('Agreed commission (%)') as HTMLInputElement;
  expect(rate.value).toBe('13');
  expect(rate.disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Approve listing' }));
  await waitFor(() =>
    expect(p.onApprove).toHaveBeenCalledWith('sp', { baseWebsitePrice: 9000 })
  );
});
