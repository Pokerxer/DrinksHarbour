// @ts-nocheck
'use client';

import { Title } from 'rizzui';

const typeLabel = (type: string) =>
  type
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

interface SpecRow {
  label: string;
  value: string;
}

export default function ProductSpecTable({ product }: { product: any }) {
  const rows: SpecRow[] = [];

  if (product.type) {
    rows.push({ label: 'Type', value: typeLabel(product.type) });
  }
  if (product.subType) {
    rows.push({ label: 'Sub-Type', value: product.subType });
  }
  if (product.categoryName) {
    rows.push({ label: 'Category', value: product.categoryName });
  }
  if (product.subCategoryName) {
    rows.push({ label: 'Sub-Category', value: product.subCategoryName });
  }
  if (product.brandName) {
    rows.push({ label: 'Brand', value: product.brandName });
  }
  if (product.producer) {
    rows.push({ label: 'Producer', value: product.producer });
  }
  const origin = [product.region, product.originCountry].filter(Boolean).join(', ');
  if (origin) {
    rows.push({ label: 'Origin', value: origin });
  }

  // Beverage-specific
  if (product.isBeverage) {
    if (product.isAlcoholic) {
      rows.push({ label: 'Alcoholic', value: 'Yes' });
    }
    if (product.abv !== undefined && product.abv !== null) {
      rows.push({ label: 'ABV', value: `${product.abv}%` });
    }
    if (product.volumeMl !== undefined && product.volumeMl !== null) {
      rows.push({ label: 'Volume', value: `${product.volumeMl} ml` });
    }
  }

  // Non-beverage specific
  if (!product.isBeverage) {
    if (product.material) {
      rows.push({ label: 'Material', value: product.material });
    }
    if (
      product.packCount !== undefined &&
      product.packCount !== null &&
      product.packCount !== ''
    ) {
      rows.push({ label: 'Pieces / Pack', value: `${product.packCount}` });
    }
    if (product.shelfLifeDays !== undefined && product.shelfLifeDays !== null) {
      rows.push({
        label: 'Shelf Life',
        value: `${product.shelfLifeDays} days`,
      });
    }
  }

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <Title as="h6" className="font-inter text-sm font-semibold">
        Specifications
      </Title>
      <div className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-6 py-2.5 text-sm"
          >
            <span className="shrink-0 font-medium text-gray-900">
              {row.label}
            </span>
            <span className="text-right text-gray-600">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}