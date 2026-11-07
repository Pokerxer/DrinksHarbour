'use client';

import { useMemo, useState } from 'react';
import { PiArrowDown, PiWarningCircle } from 'react-icons/pi';
import DirectoryFilters from '@/components/Stores/DirectoryFilters';
import DirectoryHero from '@/components/Stores/DirectoryHero';
import DirectoryResults from '@/components/Stores/DirectoryResults';
import { useStoreDirectory } from '@/components/Stores/useStoreDirectory';
import type { SortKey } from '@/components/Stores/directory.types';

export default function VendorsClient() {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [sort, setSort] = useState<SortKey>('products');
  const { stores, pagination, loading, loadingMore, error, hasMore, query, loadMore, retry } = useStoreDirectory(search, location, sort);
  const clearFilters = () => { setSearch(''); setLocation(''); setSort('products'); };
  const filtered = !!(query.search || query.location || sort !== 'products');
  const featuredStores = useMemo(() => filtered ? [] : stores.filter(store => (store.productCount ?? 0) > 0).slice(0, 3), [stores, filtered]);
  const regularStores = useMemo(() => {
    const ids = new Set(featuredStores.map(store => store._id));
    return stores.filter(store => !ids.has(store._id));
  }, [stores, featuredStores]);

  return <div className="min-h-screen bg-gray-50">
    <DirectoryHero totalVendors={pagination?.total} />
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <DirectoryFilters search={search} location={location} sort={sort} onSearch={setSearch}
        onLocation={setLocation} onSort={setSort} onClear={clearFilters} total={pagination?.total} loading={loading} />
      {error && !loading && <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
        <PiWarningCircle aria-hidden="true" size={20} className="shrink-0 text-red-600" />
        <p className="text-sm text-red-700">{error}</p>
        <button type="button" onClick={retry} disabled={loadingMore} className="ml-auto rounded-lg px-2 py-2 text-sm text-red-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700">Retry</button>
      </div>}
      <div aria-busy={loading || loadingMore}>
        <DirectoryResults loading={loading} stores={stores} featuredStores={featuredStores} regularStores={regularStores}
          error={error} filtered={filtered} pagination={pagination} clearFilters={clearFilters} />
      </div>
      {hasMore && !loading && <div className="mt-8 flex justify-center">
        <button type="button" onClick={loadMore} disabled={loadingMore}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition-colors hover:border-red-200 hover:text-red-700 disabled:opacity-50">
          {loadingMore ? 'Loading…' : <><PiArrowDown aria-hidden="true" size={16} /> Load more vendors</>}
        </button>
      </div>}
    </div>
  </div>;
}
