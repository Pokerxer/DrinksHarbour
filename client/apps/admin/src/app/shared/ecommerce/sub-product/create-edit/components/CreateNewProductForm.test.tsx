// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TenantProvider } from '@/context/TenantContext';
import CreateNewProductForm from './CreateNewProductForm';

vi.mock('next-auth/react', () => ({ useSession: () => ({ data: null }) }));

afterEach(cleanup);

it.each([
  { industry: 'food-service', label: 'Fresh Produce', type: 'foodservice_produce', excluded: 'Cigars & Tobacco' },
  { industry: 'hospitality', label: 'Cigars & Tobacco', type: 'hospitality_cigar', excluded: 'Fresh Produce' },
])('creates an inline product with the $industry type options', ({ industry, label, type, excluded }) => {
  const onChange = vi.fn();
  render(
    <TenantProvider initialTenant={{ _id: 'tenant', name: 'Venue', slug: 'venue', industries: [industry] }}>
      <CreateNewProductForm value={null} onChange={onChange} />
    </TenantProvider>
  );

  const option = screen.getByRole('option', { name: label });
  expect(screen.queryByRole('option', { name: excluded })).toBeNull();
  fireEvent.change(option.closest('select')!, { target: { value: type } });
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type, isAlcoholic: false }));
});
