import * as Icon from 'react-icons/pi';
import StoreCard from './StoreCard';
import SkeletonCard from './SkeletonCard';
import type { Store, Pagination } from './directory.types';

export default function DirectoryResults({ loading, stores, featuredStores, regularStores, error, filtered, pagination, clearFilters }: {
  loading: boolean; stores: Store[]; featuredStores: Store[]; regularStores: Store[]; error: string;
  filtered: boolean; pagination: Pagination | null; clearFilters: () => void;
}) {
  return <>
        {/* Skeleton */}
        {loading && (
          <>
            {/* Featured row skeleton */}
            <div className="mb-8">
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} tall />)}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </>
        )}

        {/* Empty */}
        {!loading && stores.length === 0 && !error && (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon.PiStorefront size={36} className="text-gray-300" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No vendors found</h3>
            {filtered ? (
              <>
                <p className="text-gray-400 text-sm mb-4">No results for your current filters</p>
                <button
                  onClick={clearFilters}
                  className="text-sm text-red-700 underline"
                >
                  Clear filters
                </button>
              </>
            ) : (
              <p className="text-gray-400 text-sm">Check back soon — we&apos;re adding new vendors.</p>
            )}
          </div>
        )}

        {/* Featured Top Vendors */}
        {!loading && featuredStores.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
              <Icon.PiStar size={16} className="text-amber-500" />
              Top Vendors
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {featuredStores.map(store => (
                <StoreCard key={store._id} store={store} featured />
              ))}
            </div>
          </div>
        )}

        {/* All Vendors Grid */}
        {!loading && regularStores.length > 0 && (
          <>
            {featuredStores.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-gray-900">
                  {pagination && `All Vendors (${pagination.total})`}
                </h2>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {regularStores.map(store => (
                <StoreCard key={store._id} store={store} />
              ))}
            </div>
          </>
        )}

  </>;
}
