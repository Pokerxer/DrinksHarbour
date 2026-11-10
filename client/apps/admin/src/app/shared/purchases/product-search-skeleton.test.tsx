// app/shared/purchases/product-search-skeleton.test.tsx
// @vitest-environment jsdom
// The product search dropdown's in-flight state: while the debounced server
// search is running, the dropdown shows shimmer rows instead of flashing the
// "No products match" empty state (the screenshot bug).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ProductSearchSkeleton from './product-search-skeleton';

afterEach(cleanup);

describe('ProductSearchSkeleton', () => {
  it('announces itself as a loading status with shimmer rows', () => {
    render(<ProductSearchSkeleton />);
    const status = screen.getAllByRole('status').at(-1) as HTMLElement;
    expect(status.getAttribute('aria-busy')).toBe('true');
    expect(status.textContent).toMatch(/searching/i);
    // Skeleton rows are presentational spans (shimmer bars).
    const rows = status.querySelectorAll('[data-skeleton-row]');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('respects the requested row count', () => {
    render(<ProductSearchSkeleton rows={2} />);
    expect(
      screen.getByRole('status').querySelectorAll('[data-skeleton-row]'),
    ).toHaveLength(2);
  });
});
