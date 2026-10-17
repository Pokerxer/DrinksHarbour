// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProductEditHeader from './ProductEditHeader';
afterEach(cleanup);
const props = () => ({
  title: 'Bottega Gianduia Chocolate Cream Liqueur',
  isEditMode: true,
  status: 'approved',
  saving: false,
  generating: false,
  canGenerate: true,
  saveStatus: 'idle' as const,
  dirty: true,
  metrics: { onHand: 4, price: 39000, variants: 1, sold: 0 },
  index: 5,
  total: 14,
  searchContext: '"bottega"',
  onBack: vi.fn(),
  onNew: vi.fn(),
  onSave: vi.fn(),
  onGenerate: vi.fn(),
  onPrevious: vi.fn(),
  onNext: vi.fn(),
  onPreview: vi.fn(),
  onVariants: vi.fn(),
  onOnHand: vi.fn(),
  onSold: vi.fn(),
});
it('keeps one record navigator, full title and actual metrics without placeholder actions', () => {
  render(<ProductEditHeader {...props()} />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
    'Bottega Gianduia Chocolate Cream Liqueur'
  );
  expect(screen.getAllByRole('button', { name: 'Previous product' })).toHaveLength(
    1
  );
  expect(screen.getAllByRole('button', { name: 'Next product' })).toHaveLength(1);
  expect(screen.getByLabelText('Product position').textContent).toBe('6 of 14');
  expect(screen.getByText('₦39,000')).toBeTruthy();
  expect(screen.queryByText('Purchased')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  expect(screen.getByText('Unsaved changes')).toBeTruthy();
});
it('preserves save, AI, new, preview, variants and navigation callbacks', () => {
  const p = props();
  render(<ProductEditHeader {...p} />);
  for (const [label, handler] of [
    ['Save changes', p.onSave],
    ['New product', p.onNew],
    ['Generate with AI', p.onGenerate],
    ['Previous product', p.onPrevious],
    ['Next product', p.onNext],
    ['View on website', p.onPreview],
    ['View tenant listings', p.onVariants],
    ['View on-hand stock', p.onOnHand],
    ['View sold history', p.onSold],
    ['Back to products', p.onBack],
  ] as const) {
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(handler).toHaveBeenCalledOnce();
  }
});
it('disables boundary navigation and busy actions, and does not invent an unknown price', () => {
  const p = props();
  const { rerender } = render(
    <ProductEditHeader
      {...p}
      index={0}
      saving
      generating
      metrics={{ ...p.metrics, price: 0 }}
    />
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Previous product',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(
    (screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  expect(
    (
      screen.getByRole('button', {
        name: 'Generate with AI',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  expect(
    within(screen.getByLabelText('Product metrics')).getByText('—')
  ).toBeTruthy();
  rerender(<ProductEditHeader {...p} index={13} />);
  expect(
    (screen.getByRole('button', { name: 'Next product' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
});
it('does not render fake record positions or edit-only actions for a new product', () => {
  render(
    <ProductEditHeader
      {...props()}
      isEditMode={false}
      canGenerate={false}
      index={-1}
      total={0}
    />
  );
  expect(screen.queryByLabelText('Product position')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Generate with AI' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'View on website' })).toBeNull();
});
it('distinguishes local draft persistence from saving changes to the platform', () => {
  render(
    <ProductEditHeader
      {...props()}
      saveStatus="saved"
      lastDraftSaved={new Date('2026-10-16T20:00:00Z')}
    />
  );
  expect(screen.getByText('Unsaved changes')).toBeTruthy();
  expect(screen.getByText(/Draft saved on this device/)).toBeTruthy();
  expect(screen.queryByText('Changes saved')).toBeNull();
});
