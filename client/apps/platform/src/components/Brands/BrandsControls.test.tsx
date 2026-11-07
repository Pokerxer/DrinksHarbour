import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BrandsFilters from './BrandsFilters';
import BrandAlphabet from './BrandAlphabet';
import BrandCard from './BrandCard';

afterEach(cleanup);

it('keeps every supplied country available while filtering and exposes named controls', () => {
  render(<BrandsFilters search="House" country="France" sort="name_asc" countries={['France', 'Nigeria']}
    resultCount={1} onSearchChange={vi.fn()} onCountryChange={vi.fn()} onSortChange={vi.fn()} onClearAll={vi.fn()} />);
  expect(screen.getByRole('searchbox', { name: 'Search brands by name' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Country of origin' })).toBeTruthy();
  expect(screen.getByRole('option', { name: 'Nigeria' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Sort brands' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Clear brand search' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Clear country filter' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('1 brand');
});

it('clears each filter independently and resets the whole filter set', () => {
  const search = vi.fn(), country = vi.fn(), clear = vi.fn(), sort = vi.fn();
  render(<BrandsFilters search="House" country="France" sort="name_asc" countries={['France']}
    resultCount={2} onSearchChange={search} onCountryChange={country} onSortChange={sort} onClearAll={clear} />);
  fireEvent.click(screen.getByRole('button', { name: 'Clear brand search' }));
  expect(search).toHaveBeenCalledWith('');
  fireEvent.click(screen.getByRole('button', { name: 'Clear country filter' }));
  expect(country).toHaveBeenCalledWith('');
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort brands' }), { target: { value: 'products' } });
  expect(sort).toHaveBeenCalledWith('products');
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(clear).toHaveBeenCalledOnce();
});

it('allows another populated letter while one is selected and announces its selected state', () => {
  const change = vi.fn();
  render(<BrandAlphabet availableLetters={['A', 'B']} value="A" onChange={change} />);
  expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('true');
  const button = screen.getByRole('button', { name: 'B' }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(change).toHaveBeenLastCalledWith('B');
  fireEvent.click(screen.getByRole('button', { name: 'All brands' }));
  expect(change).toHaveBeenLastCalledWith(null);
});

it('does not imply a known count when a brand has no cached product count', () => {
  render(<BrandCard brand={{ _id: '1', name: 'House', slug: 'house' }} />);
  expect(screen.queryByText(/\d+ products/)).toBeNull();
  expect(screen.getByRole('link', { name: /House/ }).getAttribute('href')).toBe('/brands/house');
  expect(screen.getByText('Explore brand')).toBeTruthy();
});

it('shows explicit zero counts without hiding the brand', () => {
  render(<BrandCard brand={{ _id: '1', name: 'House', slug: 'house', productCount: 0 }} />);
  expect(screen.getByText('0 products')).toBeTruthy();
  expect(screen.getByRole('link', { name: /House/ })).toBeTruthy();
});
