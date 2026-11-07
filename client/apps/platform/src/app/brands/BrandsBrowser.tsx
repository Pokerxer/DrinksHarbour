'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { PiShoppingCart, PiTag, PiWarningCircle } from 'react-icons/pi';
import BrandCard from '@/components/Brands/BrandCard';
import BrandsHero from '@/components/Brands/BrandsHero';
import BrandSkeleton from '@/components/Brands/BrandSkeleton';
import BrandsFilters from '@/components/Brands/BrandsFilters';
import BrandAlphabet from '@/components/Brands/BrandAlphabet';
import { useBrandsDirectory } from '@/components/Brands/useBrandsDirectory';
import type { BrandSort } from '@/components/Brands/types';
import type { BrandCardData } from './brand-results';

const firstLetter = (name: string) => /^[A-Z]$/.test(name.trim().charAt(0).toUpperCase())
  ? name.trim().charAt(0).toUpperCase() : '#';

export default function BrandsBrowser({ initialBrands, initialError }: {
  initialBrands?: BrandCardData[];
  initialError?: string;
}) {
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState<BrandSort>('name_asc');
  const [letter, setLetter] = useState<string | null>(null);
  const { brands, catalog, hasCatalog, loading, error, retry } = useBrandsDirectory({ initialBrands, initialError, search, country });
  const countries = useMemo(() => [...new Set(catalog.map(brand => brand.countryOfOrigin).filter((value): value is string => !!value))].sort((a, b) => a.localeCompare(b)), [catalog]);
  const availableLetters = useMemo(() => [...new Set(catalog.map(brand => firstLetter(brand.name)))], [catalog]);
  const visible = useMemo(() => {
    const list = brands.filter(brand => !letter || firstLetter(brand.name) === letter);
    return list.sort((a, b) => {
      if (sort === 'name_desc') return b.name.localeCompare(a.name);
      if (sort === 'products') return (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name);
      if (sort === 'newest') return (Date.parse(b.createdAt ?? '') || 0) - (Date.parse(a.createdAt ?? '') || 0) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  }, [brands, letter, sort]);
  const clear = () => { setSearch(''); setCountry(''); setSort('name_asc'); setLetter(null); };
  const changeSearch = (value: string) => { setSearch(value); setLetter(null); };
  const changeLetter = (value: string | null) => { setLetter(value); if (value) setSearch(''); };
  const filtered = !!(search.trim() || country || letter);

  return <div className="min-h-screen bg-gray-50">
    <BrandsHero total={hasCatalog ? catalog.length : undefined} totalProducts={hasCatalog ? catalog.reduce((sum, brand) => sum + (brand.productCount ?? 0), 0) : undefined} />
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <BrandsFilters search={search} country={country} sort={sort} countries={countries} resultCount={visible.length}
        loading={loading} error={!!error} onSearchChange={changeSearch} onCountryChange={setCountry} onSortChange={setSort} onClearAll={clear} />
      <BrandAlphabet availableLetters={availableLetters} value={letter} onChange={changeLetter} />
      {error && !loading && <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <PiWarningCircle aria-hidden="true" size={20} className="shrink-0 text-red-600" />
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={retry} className="ml-auto rounded-lg px-3 py-2 text-sm text-red-700 underline focus-visible:outline-red-700">Retry</button>
      </div>}
      <div aria-busy={loading}>
        {loading && <div aria-label="Loading brands" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }, (_, index) => <BrandSkeleton key={index} />)}
        </div>}
        {!loading && !error && !visible.length && <div className="py-16 text-center">
          <PiTag aria-hidden="true" size={36} className="mx-auto mb-4 text-gray-400" />
          <h2 className="mb-2 text-lg font-semibold text-gray-700">No brands found</h2>
          <p className="mb-4 text-sm text-gray-500">{filtered ? 'Try another name, country or letter.' : 'Check back soon for more brands.'}</p>
          {filtered && <button type="button" onClick={clear} className="rounded-lg px-3 py-2 text-sm text-red-700 underline focus-visible:outline-red-700">Clear filters</button>}
        </div>}
        {!loading && !error && visible.length > 0 && <div role="list" aria-label="Brands" className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map(brand => <div role="listitem" key={brand._id} className="min-w-0"><BrandCard brand={brand} /></div>)}
        </div>}
      </div>
      {!loading && !error && !!visible.length && <div className="mt-12 text-center">
        <Link href="/shop" className="inline-flex items-center gap-2 rounded-xl bg-red-800 px-8 py-3.5 text-sm font-bold text-white shadow-md hover:bg-red-900 focus-visible:outline-red-700"><PiShoppingCart aria-hidden="true" size={17} /> Browse All Products</Link>
      </div>}
    </div>
  </div>;
}
