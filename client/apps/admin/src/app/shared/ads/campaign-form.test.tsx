// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CampaignForm from './campaign-form';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      token: 'test-token',
      user: { token: 'test-token', email: 'owner@tenant.test' },
    },
    status: 'authenticated',
  }),
}));

// The tariff shown in UI copy MUST come from the summary response
// (cpcTariff) — never hard-coded. The mock is the only source of the "₦50".
vi.mock('@/services/ads.service', () => ({
  adsService: {
    summary: vi.fn().mockResolvedValue({
      success: true,
      data: { balance: 0, cpcTariff: 50, campaigns: [] },
    }),
    create: vi.fn().mockResolvedValue({
      success: true,
      data: { _id: 'camp1', status: 'draft' },
    }),
    setStatus: vi.fn().mockResolvedValue({
      success: true,
      data: { _id: 'camp1', status: 'active' },
    }),
    list: vi.fn().mockResolvedValue({ success: true, data: [] }),
    remove: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('@/services/product.service', () => ({
  productService: {
    getProducts: vi.fn().mockResolvedValue({
      success: true,
      data: {
        products: [
          {
            _id: '507f1f77bcf86cd799439012',
            name: 'Jameson 700ml',
            slug: 'jameson-700ml',
            type: 'spirit',
          },
          {
            _id: '507f1f77bcf86cd799439013',
            name: 'Tonic Water',
            slug: 'tonic-water',
            type: 'soft-drink',
          },
        ],
      },
    }),
  },
}));

afterEach(cleanup);

// Open the picker, run a server search, pick a product by name.
async function searchAndPick(term: string, name: string) {
  fireEvent.click(
    screen.getByLabelText(/campaign product/i)
  );
  fireEvent.change(screen.getByPlaceholderText('Choose a product…'), {
    target: { value: term },
  });
  fireEvent.click(await screen.findByText(name));
}

describe('CampaignForm', () => {
  beforeEach(() => {
    push.mockClear();
  });

  it('requires name, product, a surface and a tariff-covered budget before saving', async () => {
    render(<CampaignForm />);

    // Disabled until the tariff has loaded (the minimum comes from it).
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(true)
    );

    fireEvent.change(screen.getByLabelText(/campaign name/i), {
      target: { value: 'Jameson weekend push' },
    });
    await searchAndPick('Jameson', 'Jameson 700ml');
    fireEvent.click(screen.getByLabelText(/product page/i));

    // Everything but the budget: still disabled.
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(true)
    );

    fireEvent.change(screen.getByLabelText(/daily budget/i), {
      target: { value: '100' },
    });

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
  });

  it('shows the budget minimum from the summary tariff, not a hard-coded rate', async () => {
    render(<CampaignForm />);

    // cpcTariff comes from the mocked summary response.
    expect(
      await screen.findByText(/₦50 per verified click/i)
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/campaign name/i), {
      target: { value: 'Cart push' },
    });
    await searchAndPick('Tonic', 'Tonic Water');
    fireEvent.click(screen.getByLabelText(/cart/i));
    fireEvent.change(screen.getByLabelText(/daily budget/i), {
      target: { value: '20' },
    });

    // Below the tariff: save stays disabled and the reason is named.
    expect(
      await screen.findByText(/at least ₦50/i)
    ).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('saves the campaign and offers activation', async () => {
    const { adsService } = await import('@/services/ads.service');
    render(<CampaignForm />);

    fireEvent.change(screen.getByLabelText(/campaign name/i), {
      target: { value: 'Jameson weekend push' },
    });
    await searchAndPick('Jameson', 'Jameson 700ml');
    fireEvent.click(screen.getByLabelText(/product page/i));
    fireEvent.change(screen.getByLabelText(/daily budget/i), {
      target: { value: '100' },
    });

    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(adsService.create).toHaveBeenCalledWith('test-token', {
        name: 'Jameson weekend push',
        product: '507f1f77bcf86cd799439012',
        surfaces: ['pdp'],
        dailyBudget: 100,
      });
    });

    // Post-save: the campaign is a draft — activation is offered, not forced.
    expect(await screen.findByRole('button', { name: /activate now/i })).toBeTruthy();
  });

  it('surfaces the wallet 409 inline with a link to the wallet card', async () => {
    const { adsService } = await import('@/services/ads.service');
    vi.mocked(adsService.setStatus).mockRejectedValueOnce(
      new Error('Load your ad wallet to activate')
    );
    render(<CampaignForm />);

    fireEvent.change(screen.getByLabelText(/campaign name/i), {
      target: { value: 'Cart push' },
    });
    await searchAndPick('Tonic', 'Tonic Water');
    fireEvent.click(screen.getByLabelText(/cart/i));
    fireEvent.change(screen.getByLabelText(/daily budget/i), {
      target: { value: '100' },
    });
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /save/i }) as HTMLButtonElement)
          .disabled
      ).toBe(false)
    );
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    fireEvent.click(await screen.findByRole('button', { name: /activate now/i }));

    expect(await screen.findByText(/load your ad wallet/i)).toBeTruthy();
    const link = screen.getByRole('link', { name: /top up your wallet/i });
    expect(link.getAttribute('href')).toContain('/advertising');
  });
});
