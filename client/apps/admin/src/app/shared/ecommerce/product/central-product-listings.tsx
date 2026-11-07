import Link from 'next/link';
import { routes } from '@/config/routes';
import type { BusinessVariant } from '../business-catalog/business-variant-facts';

export type CentralProductListing = {
  _id: string;
  tenant?: { name?: string } | null;
  sku?: string;
  baseSellingPrice?: number | null;
  currency?: string;
  status?: string;
  sizes?: Array<(BusinessVariant & { stock?: number }) | null>;
  isPublished?: boolean;
};

function formatPrice(value?: number | null, currency = 'NGN') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Not set';
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-NG')}`;
  }
}

export default function CentralProductListings({
  listings,
}: {
  listings: CentralProductListing[];
}) {
  return (
    <section
      aria-labelledby="tenant-listings"
      className="rounded-2xl border border-muted bg-white p-5 sm:p-6"
    >
      <h2 id="tenant-listings" className="text-lg font-semibold">
        Tenant listings{' '}
        <span className="ml-1 text-sm font-normal text-gray-500">
          ({listings.length})
        </span>
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Review the prices and options that each tenant manages for this product.
      </p>
      {listings.length ? (
        <div className="mt-4 overflow-x-auto">
          <table
            className="w-full min-w-[32rem] text-left text-sm"
            aria-labelledby="tenant-listings"
          >
            <thead className="border-b border-muted text-gray-500">
              <tr>
                {[
                  'Tenant',
                  'Base price',
                  'Options',
                  'On hand',
                  'Status',
                  'Listing',
                ].map((label) => (
                  <th key={label} scope="col" className="px-3 py-2 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listings.map((listing) => {
                const stock =
                  listing.sizes?.flatMap((size) =>
                    typeof size?.stock === 'number' &&
                    Number.isFinite(size.stock)
                      ? [size.stock]
                      : []
                  ) || [];
                const onHand =
                  stock.length &&
                  stock.length === listing.sizes?.filter(Boolean).length
                    ? stock.reduce((total, quantity) => total + quantity, 0)
                    : null;
                return (
                  <tr key={listing._id}>
                    <th scope="row" className="px-3 py-3 font-medium">
                      {listing.tenant?.name || 'Tenant unavailable'}
                    </th>
                    <td className="px-3 py-3">
                      {formatPrice(listing.baseSellingPrice, listing.currency)}
                    </td>
                    <td className="px-3 py-3">
                      {listing.sizes?.filter(Boolean).length ?? 0}
                    </td>
                    <td className="px-3 py-3">
                      {onHand?.toLocaleString('en-NG') ?? 'Not recorded'}
                    </td>
                    <td className="px-3 py-3">
                      <span className="capitalize">
                        {listing.status?.replaceAll('_', ' ') || 'Unknown'}
                      </span>
                      {typeof listing.isPublished === 'boolean' && (
                        <span className="block text-xs text-gray-500">
                          {listing.isPublished ? 'Published' : 'Unpublished'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        className="underline underline-offset-2"
                        href={routes.eCommerce.subProductDetails(listing._id)}
                        aria-label={`Open listing for ${listing.tenant?.name || listing.sku || listing._id}`}
                      >
                        {listing.sku || 'View listing'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
          No tenant listings yet.
        </p>
      )}
    </section>
  );
}
