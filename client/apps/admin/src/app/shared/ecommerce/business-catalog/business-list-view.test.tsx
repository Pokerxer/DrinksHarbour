// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BusinessListView from './business-list-view';
afterEach(cleanup);
it('exposes an accessible business selector and shows the result count', () => {
  const onChange = vi.fn();
  render(<BusinessListView business="home" onChange={onChange} count={12} />);
  expect(screen.getByRole('heading', { name: 'Home & Living' })).toBeTruthy();
  expect(screen.getByText(/12 matching products/)).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Business view' }), {
    target: { value: 'beauty' },
  });
  expect(onChange).toHaveBeenCalledWith('beauty');
});
