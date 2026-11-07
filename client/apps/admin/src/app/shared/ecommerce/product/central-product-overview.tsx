import Link from 'next/link';
import { PiPencilSimple } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { productTaxonomyLabel } from '@/utils/product-taxonomy-label';
import {
  businessPresentation,
  catalogBusiness,
} from '@/utils/catalog-business';

type Identity = string | { name?: string } | null;
export type CentralProductIdentity = {
  _id: string;
  name: string;
  type?: string;
  subType?: string;
  brand?: Identity;
  category?: Identity;
  subCategory?: Identity;
  status?: string;
  isPublished?: boolean;
  isAlcoholic?: boolean;
  shortDescription?: string;
};

const nameOf = (identity?: Identity) =>
  typeof identity === 'string' ? identity : identity?.name;
const humanize = (value?: string) => value?.replaceAll('_', ' ');

export default function CentralProductOverview({
  product,
  canEdit,
}: {
  product: CentralProductIdentity;
  canEdit: boolean;
}) {
  const business = catalogBusiness(product.type);
  // Category links can be absent on older products (or fixture/sync data).
  // Derive the taxonomy from the type labels so the section never renders
  // an empty "Category / Sub-Category" line, and show the real links when
  // they exist.
  const taxonomy =
    [nameOf(product.category), nameOf(product.subCategory)]
      .filter(Boolean)
      .join(' / ') || productTaxonomyLabel(product.type) || '';
  const status = product.isPublished
    ? 'Published'
    : humanize(product.status) || 'Unpublished';

  return (
    <section
      aria-labelledby="product-overview"
      className="rounded-2xl border border-muted bg-white p-5 sm:p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {businessPresentation[business].title}
      </p>
      <h2
        id="product-overview"
        className="mt-2 break-words text-2xl font-semibold text-gray-900"
      >
        {product.name}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {[status, humanize(product.type), humanize(product.subType)]
          .filter(Boolean)
          .map((label, index) => (
            <span
              key={index}
              className="rounded-full bg-gray-100 px-3 py-1 font-medium capitalize text-gray-700"
            >
              {label}
            </span>
          ))}
        {business === 'beverage' && product.isAlcoholic && (
          <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800">
            Alcoholic
          </span>
        )}
      </div>
      {(nameOf(product.brand) || taxonomy) && (
        <dl className="mt-5 grid gap-3 border-t border-muted pt-4 text-sm">
          {nameOf(product.brand) && (
            <div>
              <dt className="text-gray-500">Brand</dt>
              <dd className="font-medium">{nameOf(product.brand)}</dd>
            </div>
          )}
          {taxonomy && (
            <div>
              <dt className="text-gray-500">Category</dt>
              <dd className="font-medium">{taxonomy}</dd>
            </div>
          )}
        </dl>
      )}
      {product.shortDescription && (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-gray-600">
          {product.shortDescription}
        </p>
      )}
      {canEdit && (
        <Link
          href={routes.eCommerce.ediProduct(product._id)}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700"
        >
          <PiPencilSimple aria-hidden /> Edit product
        </Link>
      )}
    </section>
  );
}
