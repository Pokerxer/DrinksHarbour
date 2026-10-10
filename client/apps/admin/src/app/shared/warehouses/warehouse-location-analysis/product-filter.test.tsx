// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ProductFilter from './product-filter';
afterEach(cleanup);
const products = [
  { id: 'one', label: 'Monte do Barão · W1' },
  { id: 'two', label: 'Lagar Tinto · W2' },
  { id: 'three', label: 'Beer · B1' },
];
function Picker() {
  const [value, setValue] = useState('');
  return (
    <>
      <ProductFilter value={value} products={products} change={setValue} />
      <output data-testid="value">{value}</output>
    </>
  );
}
it('searches multiple names and selects all matches', () => {
  render(<Picker />);
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'monte, lagar' } });
  expect(screen.getByRole('checkbox', { name: 'Monte do Barão · W1' })).toBeTruthy();
  expect(screen.getByRole('checkbox', { name: 'Lagar Tinto · W2' })).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: 'Beer · B1' })).toBeNull();
  fireEvent.click(screen.getByText('Select matches'));
  expect(screen.getByTestId('value').textContent).toBe('one,two');
});
it('retains selections when searching another product and supports accent/SKU search', () => {
  render(<Picker />);
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'barao' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Monte do Barão · W1' }));
  fireEvent.change(screen.getByLabelText('Search products'), { target: { value: 'B1' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Beer · B1' }));
  expect(screen.getByTestId('value').textContent).toBe('one,three');
  fireEvent.click(screen.getByLabelText('Remove Monte do Barão · W1'));
  expect(screen.getByTestId('value').textContent).toBe('three');
});

it('shows product load failures with retry and keeps selected chips', () => {
  const retry = vi.fn();
  const { rerender } = render(<ProductFilter value="one" products={products} change={() => {}} loading />);
  fireEvent.focus(screen.getByLabelText('Search products'));
  expect(screen.getByText('Loading products…')).toBeTruthy();
  rerender(<ProductFilter value="one" products={products} change={() => {}} error="Cannot connect to the server" retry={retry} />);
  expect(screen.getByRole('alert').textContent).toContain('Cannot connect');
  fireEvent.click(screen.getByText('Retry products'));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.getByLabelText('Remove Monte do Barão · W1')).toBeTruthy();
  fireEvent.keyDown(screen.getByLabelText('Search products'), { key: 'Escape' });
  expect(screen.queryByRole('checkbox', { name: 'Monte do Barão · W1' })).toBeNull();
});
