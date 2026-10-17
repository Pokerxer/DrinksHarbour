// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import GridPagination from './GridPagination';
import { DEFAULT_SUBPRODUCT_PAGE_SIZE } from '@/utils/sub-product-pagination';
afterEach(cleanup);
it('shows 50-row ranges and prevents navigation before the first and beyond the last page', () => {
  const change = vi.fn();
  const props = {
    pageSize: DEFAULT_SUBPRODUCT_PAGE_SIZE,
    total: 101,
    totalPages: 3,
    onPageChange: change,
    onPageSizeChange: vi.fn(),
  };
  const { rerender } = render(<GridPagination {...props} pageIndex={0} />);
  expect(screen.getByText('1–50 of 101')).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
  expect(change).toHaveBeenCalledWith(1);
  rerender(<GridPagination {...props} pageIndex={2} />);
  expect(screen.getByText('101–101 of 101')).toBeDefined();
  expect(
    (screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
});
it('shows an empty range without claiming page one of zero', () => {
  render(
    <GridPagination
      pageIndex={0}
      pageSize={50}
      total={0}
      totalPages={0}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
    />
  );
  expect(screen.getByText('0 results')).toBeDefined();
  expect(screen.getByText('Page 0 of 0')).toBeDefined();
});
