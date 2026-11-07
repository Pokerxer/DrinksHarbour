'use client';

import { useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import {
  industriesForTenantDisplay,
  INDUSTRY_SELECT_OPTIONS,
} from '@/utils/industries';
import {
  businessPresentation,
  type CatalogBusiness,
} from '@/utils/catalog-business';

export function useBusinessView() {
  const { tenant } = useTenant();
  const [selection, setSelection] = useState<{
    tenant: string;
    business: CatalogBusiness;
  } | null>(null);
  const tenantKey = tenant?._id || '';
  const industries = industriesForTenantDisplay(tenant);
  const defaultBusiness = industries?.length === 1 ? industries[0] : 'all';
  const business =
    selection?.tenant === tenantKey ? selection.business : defaultBusiness;
  return {
    business,
    setBusiness: (value: CatalogBusiness) =>
      setSelection({ tenant: tenantKey, business: value }),
  };
}

export default function BusinessListView({
  business,
  onChange,
  count,
}: {
  business: CatalogBusiness;
  onChange: (value: CatalogBusiness) => void;
  count: number;
}) {
  const presentation = businessPresentation[business];
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-gray-50 p-5"
      aria-label="Business catalog view"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Business catalog · {count} matching products
          </p>
          <h2 className="mt-1 text-xl font-semibold">{presentation.title}</h2>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">
            {presentation.description}
          </p>
        </div>
        <label className="text-sm font-medium">
          Business view
          <select
            className="mt-1 block rounded-lg border-gray-300 bg-white text-sm"
            value={business}
            onChange={(event) =>
              onChange(event.target.value as CatalogBusiness)
            }
          >
            <option value="all">All businesses</option>
            {INDUSTRY_SELECT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {presentation.variants} · Search and filters apply within this view.
        Summary totals cover the full catalog.
      </p>
    </section>
  );
}
