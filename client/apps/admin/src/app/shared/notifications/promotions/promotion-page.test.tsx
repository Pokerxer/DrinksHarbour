// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PromotionPage from './promotion-page';
import type { PromotionSuggestionPlan } from '@/services/promotionSuggestions.service';
const request = vi.fn();
const plan: PromotionSuggestionPlan = {
  suggestions: [
    {
      key: 'a',
      type: 'combo',
      title: 'Wine + Mixer',
      products: [
        {
          key: 'p',
          subProductId: 'p',
          sizeId: 's',
          productName: 'Wine',
          sizeName: '75cl',
          sku: 'WINE',
          image: null,
          units: 20,
          available: 40,
          quantity: 1,
        },
      ],
      warehouseId: 'w',
      warehouseName: 'Wyn City',
      confidence: 'emerging',
      capacity: 20,
      score: 3,
      reasoning: 'Customers bought these together.',
      occasion: null,
      evidence: {
        jointBaskets: 4,
        basketCount: 10,
        support: 0.4,
        lift: 1.5,
        purchaseRate: 0.6,
      },
      pricing: {
        offerPrice: 90,
        regularPrice: 100,
        currency: 'NGN',
        discountPercent: 10,
        marginPercent: 30,
        reason: '',
      },
    },
  ],
  occasions: [],
  model: 'Local basket association rules',
  basketCount: 10,
  canPrice: true,
  truncated: false,
  generatedAt: '2026-10-10',
  warehouses: [{ _id: 'w', name: 'Wyn City' }],
  warnings: [],
  historyStart: '2026-09-01',
  historyEnd: '2026-10-01',
  days: 30,
};
vi.mock('./use-promotion-suggestions', () => ({
  usePromotionSuggestions: (query: string) => {
    request(query);
    return {
      data: plan,
      loading: false,
      error: '',
      scope: query,
      refresh: vi.fn(),
    };
  },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  request.mockClear();
});
it('filters cards, opens evidence and rejects unsafe preview quantities or discounts', () => {
  render(<PromotionPage />);
  fireEvent.click(screen.getByRole('button', { name: /Wine \+ Mixer/ }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('4 of 10 eligible baskets')).toBeTruthy();
  fireEvent.change(within(dialog).getByLabelText('Preview discount (%)'), {
    target: { value: 20 },
  });
  expect(within(dialog).getByRole('alert')).toBeTruthy();
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Close promotion details' })
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search products' }), {
    target: { value: 'nothing matches' },
  });
  expect(screen.getByText('No suggestions match your filters')).toBeTruthy();
});
it('sends settings and custom timeframe together and never activates a promotion', () => {
  render(<PromotionPage />);
  fireEvent.change(screen.getByLabelText('Maximum discount (%)'), {
    target: { value: '12' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply offer settings' }));
  expect(request.mock.lastCall?.[0]).toContain('maxDiscount=12');
  fireEvent.change(screen.getByLabelText('From date'), {
    target: { value: '2026-09-01' },
  });
  fireEvent.change(screen.getByLabelText('To date'), {
    target: { value: '2026-09-30' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply timeframe' }));
  expect(request.mock.lastCall?.[0]).toContain('startDate=2026-09-01');
  expect(screen.queryByRole('button', { name: /Activate|Publish/ })).toBeNull();
});

it('applies and clears a calendar special day in the suggestions query', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-10T12:00:00Z'));
  render(<PromotionPage />);
  fireEvent.change(screen.getByLabelText('Special day name'), {
    target: { value: 'Shop anniversary' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Special day date' }));
  fireEvent.click(screen.getByRole('option', { name: /October 20th, 2026/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply offer settings' }));
  const selected = new URLSearchParams(request.mock.lastCall?.[0]);
  expect(selected.get('eventName')).toBe('Shop anniversary');
  expect(selected.get('eventDate')).toBe('2026-10-20');
  fireEvent.click(screen.getByRole('button', { name: 'Clear special day' }));
  fireEvent.click(screen.getByRole('button', { name: 'Apply offer settings' }));
  const cleared = new URLSearchParams(request.mock.lastCall?.[0]);
  expect(cleared.get('eventName')).toBe('');
  expect(cleared.get('eventDate')).toBe('');
});
