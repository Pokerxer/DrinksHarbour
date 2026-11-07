// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import PricingCard from './PricingCard';
import ReviewOverview from './ReviewOverview';
import type { PriceDraft, PriceLine, ReviewListing } from './types';
afterEach(cleanup);
const listing: ReviewListing = {
  _id: 'sp',
  status: 'active',
  tenant: {
    name: 'Shop',
    revenueModel: 'selling_price_markup',
    sellingPriceMarkupPercentage: 20,
  },
  pricing: { sellingPriceMarkupPct: 25 },
};
const line: PriceLine = {
  id: 'base',
  label: 'Base listing',
  currency: 'NGN',
  packThreshold: null,
  pricing: {
    revenueModel: 'selling_price_markup',
    costPrice: 90000,
    tenantSellingPrice: 100000,
    platformCostPrice: 100000,
    platformSellingPrice: 125000,
    platformMarkupPct: 25,
    sellingPriceMarkupPct: 25,
    inheritedSellingPriceMarkupPct: 20,
    inheritedMarketplacePrice: 120000,
    isSellingPriceMarkupOverridden: true,
  },
};
function Card() {
  const [draft, setDraft] = useState<PriceDraft>({
    normal: '125000',
    pack: '',
  });
  return (
    <PricingCard
      line={line}
      listing={listing}
      draft={draft}
      targets={{ platform: '', tenant: '' }}
      disabled={false}
      onEdit={(field, value) =>
        setDraft((previous) => ({
          ...previous,
          ...(field === 'normal' ? { inherit: undefined } : {}),
          [field]: value,
        }))
      }
    />
  );
}
it('shows live markup to save, fixed payout and expected premium without a contradictory warning', () => {
  render(<Card />);
  expect(screen.getByLabelText('Markup to save').textContent).toBe('25%');
  fireEvent.change(screen.getByLabelText('Website price for Base listing'), {
    target: { value: '130000' },
  });
  expect(screen.getByLabelText('Markup to save').textContent).toBe('30%');
  expect(screen.queryByText(/customer price exceeds this tenant/)).toBeNull();
  expect(screen.getByText(/Tenant selling price is the payout/)).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'Use tenant default (20%)' })
  );
  expect(screen.getByLabelText('Markup to save').textContent).toBe('20%');
  expect(
    screen.getByText(/Will inherit tenant default on approval/)
  ).toBeTruthy();
});
it('listing overview distinguishes tenant default from the saved product percentage', () => {
  render(<ReviewOverview listing={listing} />);
  expect(screen.getByText('Tenant default markup')).toBeTruthy();
  expect(screen.getByText('20% on tenant selling price')).toBeTruthy();
});
it('keeps the existing competitiveness warning for a cost-markup agreement', () => {
  render(
    <PricingCard
      line={{ ...line, pricing: { ...line.pricing, revenueModel: 'markup' } }}
      listing={{
        ...listing,
        tenant: { ...listing.tenant, revenueModel: 'markup' },
      }}
      draft={{ normal: '125000', pack: '' }}
      targets={{ platform: '', tenant: '' }}
      disabled={false}
      onEdit={() => {}}
    />
  );
  expect(screen.getByText(/customer price exceeds this tenant/)).toBeTruthy();
});
it('does not present missing tenant default data as zero or enable an unusable reset', () => {
  render(
    <PricingCard
      line={{
        ...line,
        pricing: {
          ...line.pricing,
          inheritedSellingPriceMarkupPct: undefined,
          inheritedMarketplacePrice: undefined,
        },
      }}
      listing={{
        ...listing,
        tenant: { ...listing.tenant, sellingPriceMarkupPercentage: undefined },
      }}
      draft={{ normal: '125000', pack: '' }}
      targets={{ platform: '', tenant: '' }}
      disabled={false}
      onEdit={() => {}}
    />
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Use tenant default (Unavailable)',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
});
