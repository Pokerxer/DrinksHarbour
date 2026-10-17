'use client';

import { useState, type ReactNode } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { SubProductInput } from '@/validators/sub-product.schema';
import { PiCurrencyNgn, PiRuler, PiTag } from 'react-icons/pi';
import SubProductBasicInfo from './basic-info';
import SubProductPricing from './pricing';
import SubProductSizes from './sizes';

const sections = [
  { id: 'product-info', label: 'Product Info', icon: PiTag },
  { id: 'product-pricing', label: 'Pricing', icon: PiCurrencyNgn },
  { id: 'product-sizes', label: 'Sizes', icon: PiRuler },
];

function ProductSection({
  section,
  description,
  children,
}: {
  section: (typeof sections)[number];
  description: string;
  children: ReactNode;
}) {
  const Icon = section.icon;

  return (
    <section
      id={section.id}
      aria-labelledby={`${section.id}-heading`}
      tabIndex={-1}
      className="min-w-0 scroll-mt-32 rounded-xl border border-gray-200 bg-white p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:p-5"
    >
      <div className="mb-5 flex items-start gap-3 border-b border-gray-100 pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3
            id={`${section.id}-heading`}
            className="text-sm font-semibold text-gray-900"
          >
            {section.label}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ProductStep({
  onProductSelect,
}: {
  onProductSelect?: (id: string, name?: string) => void;
}) {
  const {
    control,
    formState: { errors },
  } = useFormContext<SubProductInput>();
  const [singleItem, sizes] = useWatch({
    control,
    name: ['subProductData.sellWithoutSizeVariants', 'subProductData.sizes'],
  });
  const usesVariants =
    !singleItem && Boolean(sizes?.some((size) => size.size?.trim()));
  const [defaultsExpanded, setDefaultsExpanded] = useState(false);
  const pricingErrors = errors.subProductData;
  const hasPricingErrors = Boolean(
    pricingErrors &&
      [
        'costPrice',
        'baseSellingPrice',
        'markupPercentage',
        'currency',
        'taxRate',
        'minPrice',
        'maxPrice',
        'marginPercentage',
        'salePrice',
        'saleDiscountPercentage',
        'roundUp',
        'pricingStrategy',
      ].some((field) => field in pricingErrors)
  );
  const showPricing = !usesVariants || defaultsExpanded || hasPricingErrors;
  const pricingSection = {
    ...sections[1],
    label: usesVariants ? 'Base pricing defaults' : 'Pricing',
  };
  const navigation = [sections[0], pricingSection, sections[2]];

  return (
    <div className="@container/product-step">
      <nav
        aria-label="Product sections"
        className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2"
      >
        {navigation.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-white hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </a>
        ))}
      </nav>

      <div className="grid min-w-0 items-start gap-6 @[960px]/product-step:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="min-w-0 space-y-6">
          <ProductSection
            section={sections[0]}
            description="Select or create a catalog product, then set your SKU and currency."
          >
            <SubProductBasicInfo onProductSelect={onProductSelect} />
          </ProductSection>
          <ProductSection
            section={pricingSection}
            description={
              usesVariants
                ? 'Optional defaults for new sizes. Each size has its own selling price.'
                : 'Set the base cost, selling price and markup for your store.'
            }
          >
            {usesVariants && (
              <button
                type="button"
                aria-expanded={showPricing}
                aria-controls="base-pricing-fields"
                disabled={hasPricingErrors}
                onClick={() => setDefaultsExpanded(!defaultsExpanded)}
                className="inline-flex min-h-11 items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
              >
                {showPricing ? 'Hide' : 'Show'} base pricing defaults
              </button>
            )}
            <div
              id="base-pricing-fields"
              hidden={!showPricing}
              className={usesVariants ? 'mt-5' : undefined}
            >
              <SubProductPricing />
            </div>
          </ProductSection>
        </div>

        <ProductSection
          section={sections[2]}
          description="Add size variants with their own prices and stock, or sell as a single item."
        >
          <SubProductSizes />
        </ProductSection>
      </div>
    </div>
  );
}
