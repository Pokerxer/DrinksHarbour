// app/shared/purchases/use-purchase-catalogue.ts
'use client';
import { useSalesCatalogue } from '../sales/use-sales-catalogue';
import { loadPurchaseCataloguePage } from './purchases-catalog-data';

/**
 * Purchase catalogue over the shared catalogue plumbing (search, filters,
 * facets, pagination). No pricelist: the page loader prices nothing — the
 * card shows cost prices straight from the SubProduct rows.
 */
export function usePurchaseCatalogue(
  open: boolean,
  token: string,
  warehouseId?: string,
  quantities: Record<string, number> = {},
) {
  return useSalesCatalogue(
    open,
    token,
    warehouseId,
    undefined,
    quantities,
    loadPurchaseCataloguePage,
  );
}
