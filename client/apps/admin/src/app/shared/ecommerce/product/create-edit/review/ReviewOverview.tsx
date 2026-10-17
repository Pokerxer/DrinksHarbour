import Image from 'next/image';
import type { ReviewListing } from './types';
const quantity = (v?: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? v.toLocaleString('en-NG')
    : 'Unknown';
export default function ReviewOverview({ listing: sp }: { listing: ReviewListing }) {
  const images = sp.imagesOverride?.length ? sp.imagesOverride : sp.product?.images;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold">Listing details</h3>
        <dl className="mt-3 space-y-3">
          {[
            [
              'Tenant',
              sp.tenant?.name || sp.tenant?.businessName || 'Unknown tenant',
            ],
            ['Status', sp.status],
            ['SKU', sp.sku || 'Not supplied'],
            [
              'Revenue model',
              sp.tenant?.revenueModel || sp.pricing?.revenueModel || 'Unknown',
            ],
            (sp.tenant?.revenueModel || sp.pricing?.revenueModel) === 'commission'
              ? [
                  'Agreed commission',
                  sp.tenant?.commissionPercentage != null
                    ? `${sp.tenant.commissionPercentage}% of final merchandise`
                    : 'Not supplied',
                ]
              : [
                  'Agreed tenant markup',
                  sp.tenant?.markupPercentage != null
                    ? `${sp.tenant.markupPercentage}% on cost basis`
                    : 'Not supplied',
                ],
            ['ABV', sp.product?.abv != null ? `${sp.product.abv}%` : 'Not supplied'],
            ['Origin', sp.product?.originCountry || 'Not supplied'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3 text-xs">
              <dt className="text-gray-500">{label}</dt>
              <dd className="max-w-[65%] break-words text-right font-medium text-gray-800">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {!!images?.length && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold">Product images</h3>
          <div className="grid grid-cols-3 gap-2">
            {images
              .filter((i) => i.url)
              .map((image, i) => (
                <Image
                  key={`${image.url}:${i}`}
                  src={image.url!}
                  width={256}
                  height={256}
                  unoptimized
                  alt={`${sp.product?.name || 'Product'} image ${i + 1}`}
                  className="aspect-square w-full rounded-lg bg-gray-50 object-contain"
                />
              ))}
          </div>
        </section>
      )}
      {(sp.shortDescriptionOverride ||
        sp.descriptionOverride ||
        sp.product?.description) && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold">Description</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-500">
            {sp.shortDescriptionOverride ||
              sp.descriptionOverride ||
              sp.product?.description}
          </p>
        </section>
      )}
      {sp.tenantNotes && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold">Tenant notes</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-500">
            {sp.tenantNotes}
          </p>
        </section>
      )}
      {sp.shipping && (
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold">Delivery & handling</h3>
          <p className="mt-2 text-xs leading-6 text-gray-500">
            {[
              sp.shipping.shippingClass,
              sp.shipping.weight != null ? `Weight: ${sp.shipping.weight}` : '',
              sp.shipping.fragile ? 'Fragile' : '',
              sp.shipping.requiresAgeVerification || sp.product?.isAlcoholic
                ? 'Age verification required'
                : '',
            ]
              .filter(Boolean)
              .join(' · ') || 'No handling details supplied'}
          </p>
        </section>
      )}
    </div>
  );
}
export function ReviewInventory({ listing: sp }: { listing: ReviewListing }) {
  const rows = sp.sizes?.length
    ? sp.sizes.map((s) => ({
        key: s._id,
        label: s.displayName || s.size || 'Unnamed size',
        stock: s.stock,
        reserved: s.reservedStock,
        available: s.availableStock,
      }))
    : [
        {
          key: sp._id,
          label: 'Base listing',
          stock: sp.totalStock,
          reserved: sp.reservedStock,
          available: sp.availableStock,
        },
      ];
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="text-base font-semibold">Inventory</h3>
      <p className="my-2 text-xs text-gray-500">
        Stock is read only here. Reservations reduce available quantities.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead>
            <tr>
              {['Size', 'On hand', 'Reserved', 'Available'].map((label) => (
                <th
                  scope="col"
                  key={label}
                  className="border-b p-3 text-xs font-medium text-gray-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                {[
                  r.label,
                  quantity(r.stock),
                  quantity(r.reserved),
                  quantity(r.available),
                ].map((value, i) => (
                  <td key={i} className="border-b border-gray-100 p-3 tabular-nums">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sp.warehouse && (
        <p className="mt-3 text-xs text-gray-500">
          Location:{' '}
          {[
            sp.warehouse.location,
            sp.warehouse.zone,
            sp.warehouse.aisle,
            sp.warehouse.shelf,
            sp.warehouse.bin,
          ]
            .filter(Boolean)
            .join(' · ') || 'Not supplied'}
        </p>
      )}
    </section>
  );
}
