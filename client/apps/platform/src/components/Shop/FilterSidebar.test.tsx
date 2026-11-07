import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FilterSidebar from './FilterSidebar';
import type { FilterOptions, FilterState } from '@/types/filter.types';
afterEach(cleanup);
it('keeps the drawer and backdrop above the floating support launcher', () => {
  setup();
  const dialog = screen.getByRole('dialog', { name: 'Product filters' });
  const backdrop = document.querySelector('[aria-hidden="true"].fixed');
  expect(backdrop).toBeTruthy();
  // Support uses z-index 55; neither modal layer may leave it interactive.
  expect(Number(getComputedStyle(backdrop!).zIndex)).toBeGreaterThan(55);
  expect(Number(getComputedStyle(dialog).zIndex)).toBeGreaterThan(Number(getComputedStyle(backdrop!).zIndex));
});
const filters: FilterState = { size: null, color: null, brand: ['Existing Brand'], originCountry: null,
  categoryType: null, subCategoryType: null, flavorCategory: null, priceRange: { min: 0, max: 10000 },
  showOnlySale: false, sortOption: '', minRating: null, abvRange: null, volumeRange: null };
const options: FilterOptions = { size: [], color: [], brand: ['Existing Brand', 'Appleton Estate'],
  originCountry: [], categoryType: ['wine', 'soft-drink'], subCategoryType: ['red-wine', 'white-wine'],
  flavorCategory: [], priceRange: { min: 0, max: 10000 }, abvRanges: [], volumes: [] };
function setup() {
  const apply = vi.fn();
  render(<FilterSidebar open onClose={vi.fn()} filters={filters} updateFilter={vi.fn()} data={[]}
    filterOptions={options} onApplyFilters={apply} getCountByBrand={() => 1} getCountByCategoryType={() => 1}
    getCountBySubCategoryType={() => 1} getCountByOriginCountry={() => 0} getCountByFlavorCategory={() => 0} />);
  return apply;
}
it('searches all three facets without applying until Apply is pressed', () => {
  const apply = setup();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search categories' }), { target: { value: 'soft drink' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /soft drink/i }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search brands' }), { target: { value: 'appleton' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /Appleton Estate/ }));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search subcategories' }), { target: { value: 'red wine' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /red wine/i }));
  expect(apply).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: /Apply Filters/ }));
  expect(apply).toHaveBeenCalledWith(expect.objectContaining({ categoryType: ['soft-drink'], subCategoryType: ['red-wine'], brand: ['Existing Brand', 'Appleton Estate'] }));
});
it('collapses a section accessibly and preserves its pending choices when reopened', () => {
  setup();
  fireEvent.click(screen.getByRole('checkbox', { name: /soft drink/i }));
  fireEvent.click(screen.getByRole('button', { name: /^Category/ }));
  expect(screen.queryByRole('searchbox', { name: 'Search categories' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /^Category/ }));
  expect((screen.getByRole('checkbox', { name: /soft drink/i }) as HTMLInputElement).checked).toBe(true);
});
