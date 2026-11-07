// @vitest-environment jsdom
// Interaction lock for the grouped product-type picker: the pure builder is
// covered in ./product-type-options.test.ts — this mounts the ACTUAL rizzui
// Select with buildProductTypeOptions + ProductTypeOptionContent (the exact
// wiring both identification forms use) so the interplay is regression-proof.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { Select, type SelectOption } from 'rizzui';
import {
  buildProductTypeOptions,
  PRODUCT_TYPE_HEADING_VALUE_PREFIX,
} from './product-type-options';

// Matches the identification forms: options via buildProductTypeOptions +
// getOptionDisplayValue override; value tracked by the parent.
function TypePickerHarness({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [search, setSearch] = useState('');
  const types = [
    { value: 'wine', label: 'Wine', category: 'Alcoholic' },
    { value: 'beer', label: 'Beer', category: 'Alcoholic' },
    { value: 'juice', label: 'Juice', category: 'Non-Alcoholic' },
    { value: 'fashion_dress', label: 'Dress', category: 'Fashion' },
  ];
  return (
    <Select
      searchable
      searchPlaceHolder="Type to search product types…"
      placeholder="Search and select product type"
      disableDefaultFilter
      onSearchChange={setSearch}
      options={buildProductTypeOptions(types, search)}
      getOptionDisplayValue={(option) =>
        // Render-prop mirror of what ProductTypeOptionContent produces —
        // rizzui gives getOptionDisplayValue the full option as its argument.
        option.isHeading ? (
          <b>{option.label}</b>
        ) : (
          <em>{option.label}</em>
        )
      }
      value={
        types.find((t) => t.value === value)
          ? { value, label: `${value} (Selected)` }
          : ''
      }
      onChange={(opt: SelectOption) => onChange(opt.value as string)}
    />
  );
}

afterEach(cleanup);

it('headings are visible but not selectable; real options select through', () => {
  const change = vi.fn();
  render(<TypePickerHarness value="" onChange={change} />);
  // Open the dropdown (headlessui ListboxButton, aria-haspopup="listbox").
  fireEvent.click(screen.getByRole('button', { name: /Search and select/i }));
  // Group heading is visible in the list.
  expect(screen.getByText('Alcoholic')).toBeDefined();
  // Selecting an option fires the plain type value.
  fireEvent.click(screen.getByText('Wine'));
  expect(change).toHaveBeenCalledWith('wine');
});

it('searching flattens results and matches the group name', () => {
  const change = vi.fn();
  render(<TypePickerHarness value="" onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: /Search and select/i }));
  const search = screen.getByPlaceholderText('Type to search product types…');
  fireEvent.change(search, { target: { value: 'non-alcoholic' } });
  // 'Non-Alcoholic' heading is NOT rendered in search mode.
  const options = screen.getAllByRole('option');
  expect(options.some((o) => o.textContent?.includes(PRODUCT_TYPE_HEADING_VALUE_PREFIX))).toBe(false);
  expect(options.some((o) => o.textContent?.includes('Juice'))).toBe(true);
  expect(options.some((o) => o.textContent?.includes('Wine'))).toBe(false);
  fireEvent.click(screen.getByText('Juice'));
  expect(change).toHaveBeenCalledWith('juice');
});
