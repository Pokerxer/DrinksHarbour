// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import BusinessGenerationPanel from './business-generation-panel';
import { subproductService } from '@/services/subproduct.service';
vi.mock('@/services/subproduct.service', () => ({
  subproductService: {
    generateSubProductContent: vi.fn(),
    updateSubProduct: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
it('reviews and edits business SEO before saving only listing fields', async () => {
  vi.mocked(subproductService.generateSubProductContent).mockResolvedValue({
    data: {
      metaTitle: 'Desk lamp',
      metaDescription: 'Desk lighting',
      metaKeywords: ['lamp'],
      seoH1: 'Lamp',
      sellingPrice: '1',
    },
    metadata: { provider: 'Anthropic', model: 'test-model' },
  });
  vi.mocked(subproductService.updateSubProduct).mockResolvedValue({
    success: true,
  });
  const saved = vi.fn();
  render(
    <BusinessGenerationPanel
      id="listing"
      token="token"
      productType="home_lighting"
      onSaved={saved}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate SEO' }));
  await screen.findByText('Review SEO draft');
  expect(subproductService.updateSubProduct).not.toHaveBeenCalled();
  expect(subproductService.generateSubProductContent).toHaveBeenCalledWith(
    null,
    'listing',
    'token',
    null,
    'seo'
  );
  fireEvent.change(screen.getByLabelText('Search title'), {
    target: { value: 'Edited lamp title' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save draft to listing' })
  );
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(subproductService.updateSubProduct).toHaveBeenCalledWith(
    'listing',
    {
      metaTitle: 'Edited lamp title',
      metaDescription: 'Desk lighting',
      metaKeywords: ['lamp'],
      seoH1: 'Lamp',
    },
    'token',
    undefined
  );
});
it('shows generation failure without saving', async () => {
  vi.mocked(subproductService.generateSubProductContent).mockRejectedValue(
    new Error('Service unavailable')
  );
  render(
    <BusinessGenerationPanel
      id="listing"
      token="token"
      productType="beauty_skincare"
      onSaved={() => {}}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate content' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'Service unavailable'
  );
  expect(subproductService.updateSubProduct).not.toHaveBeenCalled();
});
it('retains an edited draft after save failure and supports discarding it', async () => {
  vi.mocked(subproductService.generateSubProductContent).mockResolvedValue({
    data: {
      shortDescriptionOverride: 'A cream',
      descriptionOverride: 'Recorded product facts.',
      customKeywords: ['cream'],
      tenantNotes: '',
    },
  });
  vi.mocked(subproductService.updateSubProduct).mockRejectedValue(
    new Error('Save failed')
  );
  render(
    <BusinessGenerationPanel
      id="listing"
      token="token"
      tenantSlug="shop"
      productType="beauty_skincare"
      onSaved={() => {}}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate content' }));
  await screen.findByText('Review content draft');
  fireEvent.change(screen.getByLabelText('Short description'), {
    target: { value: 'Edited cream' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save draft to listing' })
  );
  await screen.findByRole('alert');
  expect(
    (screen.getByLabelText('Short description') as HTMLTextAreaElement).value
  ).toBe('Edited cream');
  expect(subproductService.updateSubProduct).toHaveBeenCalledWith(
    'listing',
    expect.objectContaining({ shortDescriptionOverride: 'Edited cream' }),
    'token',
    'shop'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(screen.queryByText('Review content draft')).toBeNull();
});
