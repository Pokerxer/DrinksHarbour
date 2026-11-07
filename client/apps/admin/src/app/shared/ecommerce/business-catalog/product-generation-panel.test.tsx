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
import { productService } from '@/services/product.service';
import { subproductService } from '@/services/subproduct.service';
vi.mock('@/services/product.service', () => ({
  productService: { generateCatalogContent: vi.fn(), updateProduct: vi.fn() },
}));
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
it('reviews central content and saves only public description fields', async () => {
  vi.mocked(productService.generateCatalogContent).mockResolvedValue({
    data: {
      shortDescription: 'A serum',
      description: 'Recorded formulation.',
      tenantNotes: 'private',
      isPublished: 'true',
    },
  });
  vi.mocked(productService.updateProduct).mockResolvedValue({ success: true });
  const onSaved = vi.fn();
  render(
    <BusinessGenerationPanel
      id="product-id"
      target="product"
      productType="beauty_skincare"
      token="token"
      onSaved={onSaved}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate content' }));
  await screen.findByText('Review content draft');
  expect(productService.updateProduct).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Internal notes')).toBeNull();
  fireEvent.change(screen.getByLabelText('Description'), {
    target: { value: 'Reviewed serum description.' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Save draft to central product' })
  );
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(productService.updateProduct).toHaveBeenCalledWith(
    'product-id',
    { shortDescription: 'A serum', description: 'Reviewed serum description.' },
    'token'
  );
  expect(subproductService.updateSubProduct).not.toHaveBeenCalled();
});
it('previews central SEO and can discard without saving', async () => {
  vi.mocked(productService.generateCatalogContent).mockResolvedValue({
    data: {
      metaTitle: 'Laptop',
      metaDescription: 'Recorded laptop configuration.',
      metaKeywords: ['laptop'],
      seoH1: 'Laptop',
    },
  });
  render(
    <BusinessGenerationPanel
      id="product-id"
      target="product"
      productType="electronics_laptop"
      token="token"
      onSaved={() => {}}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Generate SEO' }));
  await screen.findByText('Review SEO draft');
  expect(productService.generateCatalogContent).toHaveBeenCalledWith(
    'product-id',
    'token',
    'seo'
  );
  expect(screen.getByLabelText('Search preview').textContent).toContain(
    'Laptop'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
  expect(productService.updateProduct).not.toHaveBeenCalled();
});
