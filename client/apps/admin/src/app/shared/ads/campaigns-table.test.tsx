// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import CampaignsTable from './campaigns-table';

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { token: 'test-token', user: { token: 'test-token' } },
    status: 'authenticated',
  }),
}));

vi.mock('@/services/ads.service', () => ({
  adsService: {
    list: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          _id: 'camp1',
          name: 'Jameson weekend push',
          product: '507f1f77bcf86cd799439012',
          surfaces: ['pdp', 'cart'],
          status: 'active',
          dailyBudget: 1000,
          spentToday: 250,
          spentTotal: 250,
          clicksTotal: 5,
          impressionsTotal: 100,
        },
        {
          _id: 'camp2',
          name: 'Tonic cart push',
          product: '507f1f77bcf86cd799439013',
          surfaces: ['cart'],
          status: 'draft',
          dailyBudget: 500,
          spentToday: 0,
          spentTotal: 0,
          clicksTotal: 0,
          impressionsTotal: 0,
        },
      ],
    }),
    summary: vi.fn().mockResolvedValue({
      success: true,
      data: { balance: 0, cpcTariff: 50, campaigns: [] },
    }),
    setStatus: vi.fn().mockResolvedValue({ success: true }),
    remove: vi.fn().mockResolvedValue({ success: true }),
    create: vi.fn(),
    initializeTopup: vi.fn(),
  },
}));

vi.mock('@/services/product.service', () => ({
  productService: {
    getProducts: vi.fn().mockResolvedValue({
      success: true,
      data: {
        products: [
          { _id: '507f1f77bcf86cd799439012', name: 'Jameson 700ml' },
          { _id: '507f1f77bcf86cd799439013', name: 'Tonic Water' },
        ],
      },
    }),
  },
}));

afterEach(cleanup);

describe('CampaignsTable', () => {
  it('renders rows with status chips, surfaces and spend progress', async () => {
    render(<CampaignsTable pageSize={20} />);

    expect(await screen.findByText('Jameson weekend push')).toBeTruthy();
    expect(screen.getByText('Tonic cart push')).toBeTruthy();

    // Product names resolved client-side from the product search.
    expect(screen.getByText('Jameson 700ml')).toBeTruthy();
    expect(screen.getByText('Tonic Water')).toBeTruthy();

    // Status chips (one per row).
    expect(screen.getByText(/^active$/i)).toBeTruthy();
    expect(screen.getByText(/^draft$/i)).toBeTruthy();

    // Surfaces as chips.
    expect(screen.getByText('PDP')).toBeTruthy();
    expect(screen.getAllByText('Cart').length).toBeGreaterThanOrEqual(1);

    // Spend progress of the daily budget.
    expect(screen.getByText(/₦250/)).toBeTruthy();
    expect(screen.getByText(/₦1,000/)).toBeTruthy();
  });

  it('pauses an active campaign via PATCH status', async () => {
    const { adsService } = await import('@/services/ads.service');
    render(<CampaignsTable pageSize={20} />);

    fireEvent.click(await screen.findByRole('button', { name: /pause jameson/i }));

    await waitFor(() => {
      expect(adsService.setStatus).toHaveBeenCalledWith(
        'test-token',
        'camp1',
        'paused'
      );
    });
  });

  it('activates a paused/draft campaign via PATCH status', async () => {
    const { adsService } = await import('@/services/ads.service');
    render(<CampaignsTable pageSize={20} />);

    fireEvent.click(await screen.findByRole('button', { name: /activate tonic/i }));

    await waitFor(() => {
      expect(adsService.setStatus).toHaveBeenCalledWith(
        'test-token',
        'camp2',
        'active'
      );
    });
  });

  it('deletes a draft campaign only after the confirm dialog', async () => {
    const { adsService } = await import('@/services/ads.service');
    render(<CampaignsTable pageSize={20} />);

    fireEvent.click(await screen.findByRole('button', { name: /delete tonic/i }));

    // Not deleted until confirmed.
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(adsService.remove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(adsService.remove).toHaveBeenCalledWith('test-token', 'camp2');
    });
  });
});
