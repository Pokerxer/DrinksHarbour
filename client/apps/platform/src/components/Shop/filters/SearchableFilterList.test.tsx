import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useState } from 'react';
import SearchableFilterList from './SearchableFilterList';
afterEach(cleanup);
it('keeps long lists bounded and scrollable without generated utility CSS', () => {
  render(<List />);
  const region = screen.getByRole('region', { name: 'Brands options' });
  // Live CSS lacks the overflow utility: a height cap alone lets options
  // paint over neighbouring sections. All options must remain reachable.
  const style = getComputedStyle(region);
  expect(['auto', 'scroll']).toContain(style.overflowY);
  expect(style.maxHeight).toBe('256px');
  expect(screen.getAllByRole('checkbox')).toHaveLength(options.length);
});
const options = [...Array.from({ length: 35 }, (_, i) => `Brand ${i + 1}`), 'Appleton Estate'];
function List() {
  const [selected, setSelected] = useState<string[]>(['Brand 1']);
  return <SearchableFilterList title="Brands" options={options} selected={selected} applied={['Brand 1']}
    getCount={() => 2} onToggle={value => setSelected(current => current.includes(value) ? current.filter(v => v !== value) : [...current, value])} />;
}
it('searches the complete list and preserves hidden selections when toggling another option', () => {
  render(<List />);
  expect(screen.getByRole('checkbox', { name: /Appleton Estate/ })).toBeTruthy();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search brands' }), { target: { value: '  APPLETON  ' } });
  expect(screen.queryByRole('checkbox', { name: /Brand 1\b/ })).toBeNull();
  fireEvent.click(screen.getByRole('checkbox', { name: /Appleton Estate/ }));
  expect((screen.getByRole('checkbox', { name: /Appleton Estate/ }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Clear brands search' }));
  expect((screen.getByRole('checkbox', { name: /Brand 1\b/ }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole('checkbox', { name: /Appleton Estate/ }) as HTMLInputElement).checked).toBe(true);
});
it('searches readable category names rather than requiring hyphenated slugs', () => {
  render(<SearchableFilterList title="Categories" options={['soft-drink', 'red-wine']} selected={null} applied={null}
    formatLabel={value => value.replace(/-/g, ' ')} getCount={() => 1} onToggle={vi.fn()} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search categories' }), { target: { value: 'soft drink' } });
  expect(screen.getByRole('checkbox', { name: /soft drink/i })).toBeTruthy();
  expect(screen.queryByRole('checkbox', { name: /red wine/i })).toBeNull();
});
it('explains an empty search and allows clearing it without changing selections', () => {
  render(<List />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no such brand' } });
  expect(screen.getByText('No brands found')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Clear brands search' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(options.length);
});
