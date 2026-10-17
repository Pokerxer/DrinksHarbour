// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';
import type { SubProductInput } from '@/validators/sub-product.schema';
import { sizeOptionSchema } from '@/validators/sub-product.schema';
import ProductStep from './product-step';

vi.mock('./basic-info', () => ({ default: () => <p>Catalog selection</p> }));
vi.mock('./sizes', () => ({ default: () => <p>Variant editor</p> }));
vi.mock('./pricing', () => ({
  default: () => (
    <label>
      Base cost
      <input defaultValue="500" />
    </label>
  ),
}));
afterEach(cleanup);

function setup({ single = false, selected = true } = {}) {
  let methods: UseFormReturn<SubProductInput>;
  function Harness() {
    methods = useForm<SubProductInput>({
      defaultValues: {
        subProductData: {
          sellWithoutSizeVariants: single,
          sizes: selected ? [{ size: '50cl' }] : [],
        },
      },
    });
    return (
      <FormProvider {...methods}>
        <ProductStep />
      </FormProvider>
    );
  }
  render(<Harness />);
  return () => methods;
}

describe('conditional Product step pricing', () => {
  it('collapses optional base defaults when a size is selected and lets users expand them', () => {
    setup();
    const toggle = screen.getByRole('button', {
      name: 'Show base pricing defaults',
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('textbox', { name: 'Base cost' })).toBeNull();
    fireEvent.click(toggle);
    expect(screen.getByRole('textbox', { name: 'Base cost' })).toBeDefined();
    expect(
      screen
        .getByRole('button', { name: 'Hide base pricing defaults' })
        .getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('shows pricing before selection and in single-item mode, preserving input edits across toggles', () => {
    const getMethods = setup({ selected: false });
    const input = screen.getByRole('textbox', { name: 'Base cost' });
    fireEvent.change(input, { target: { value: '800' } });
    act(() =>
      getMethods().setValue('subProductData.sizes', [
        sizeOptionSchema.parse({ size: '50cl' }),
      ])
    );
    expect(screen.queryByRole('textbox', { name: 'Base cost' })).toBeNull();
    act(() =>
      getMethods().setValue('subProductData.sellWithoutSizeVariants', true)
    );
    expect(
      (screen.getByRole('textbox', { name: 'Base cost' }) as HTMLInputElement)
        .value
    ).toBe('800');
    expect(
      screen.queryByRole('button', { name: 'Show base pricing defaults' })
    ).toBeNull();
  });

  it('exposes invalid base pricing instead of hiding its errors', () => {
    const getMethods = setup();
    act(() =>
      getMethods().setError('subProductData.costPrice', {
        type: 'manual',
        message: 'Invalid cost',
      })
    );
    expect(screen.getByRole('textbox', { name: 'Base cost' })).toBeDefined();
  });
});
