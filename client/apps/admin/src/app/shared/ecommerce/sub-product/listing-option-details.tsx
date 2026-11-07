import { type CatalogBusiness } from '@/utils/catalog-business';
import {
  businessVariantFacts,
  type BusinessVariant,
} from '../business-catalog/business-variant-facts';

export type ListingOption = BusinessVariant & {
  id?: string;
  isDefault?: boolean;
  isOnSale?: boolean;
  sellingPrice?: number | null;
  salePrice?: number | null;
  currency?: string;
  stock?: number | null;
  availability?: string | boolean;
};

export function formatListingPrice(
  value: number | null | undefined,
  currency: string
) {
  if (value == null || !Number.isFinite(value)) return null;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('en-NG')}`;
  }
}

function stockLabel(stock?: number | null, availability?: string | boolean) {
  const specialLabels: Record<string, string> = {
    pre_order: 'Pre-order',
    coming_soon: 'Coming soon',
    discontinued: 'Discontinued',
    backorder: 'Backorder',
    out_of_stock: 'Out of stock',
  };
  if (availability === false) return 'Unavailable';
  if (typeof availability === 'string' && specialLabels[availability]) {
    return specialLabels[availability];
  }
  if (stock == null || !Number.isFinite(stock)) return 'Stock not recorded';
  if (stock <= 0) return 'Out of stock';
  if (availability === 'low_stock' || availability === 'limited_stock') {
    return `Limited stock · ${stock}`;
  }
  return `In stock · ${stock}`;
}

export function ListingStock({
  stock,
  availability,
}: Pick<ListingOption, 'stock' | 'availability'>) {
  return (
    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
      {stockLabel(stock, availability)}
    </span>
  );
}

const friendlySizeNames: Record<string, string> = {
  'unit-single': 'Single',
  'piece-single': 'Single piece',
  'box-single': 'Single box',
  'bar-single': 'Single bar',
  'bar-2': '2-bar pack',
};

function optionName(option: ListingOption) {
  if (option.displayName && option.displayName !== option.size)
    return option.displayName;
  const size = option.size || '';
  return (
    friendlySizeNames[size] ||
    size.replaceAll('-', ' ').replaceAll('_', ' ') ||
    'Unnamed option'
  );
}

export default function ListingOptionDetails({
  option,
  business,
  currency,
}: {
  option: ListingOption;
  business: CatalogBusiness;
  currency: string;
}) {
  const facts = businessVariantFacts(option, business);
  const optionCurrency = option.currency || currency;
  const price = formatListingPrice(
    (option.isOnSale ? option.salePrice : undefined) ?? option.sellingPrice,
    optionCurrency
  );

  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-3.5">
      <div className="min-w-0">
        <p className="break-words font-medium text-gray-900">
          {optionName(option)}
          {option.colorName && (
            <span className="text-gray-600"> · {option.colorName}</span>
          )}
          {option.isDefault && (
            <span className="ms-2 inline-block rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-blue-700">
              Default
            </span>
          )}
        </p>
        {facts.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium tabular-nums text-gray-900">
          {price || 'Price not set'}
        </span>
        <ListingStock stock={option.stock} availability={option.availability} />
      </div>
    </li>
  );
}
