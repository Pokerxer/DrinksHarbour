// app/shared/purchases/use-purchase-catalogue.ts
'use client';
import { useSalesCatalogue } from '../sales/use-sales-catalogue';
import { loadPurchaseCataloguePage } from './purchases-catalog-data';

/**
 * Purchase catalogue over the shared catalogue plumbing (search, filters,
 * facets, pagination). Prices are cost prices from the catalogue rows.
 *
 * Deliberately NOT scoped by warehouse: the sales catalogue's warehouse filter
 * keeps only products *already stocked* in that warehouse, and a purchase
 * order is about ordering stock the destination does not have yet — scoping
 * would empty the modal as soon as a destination warehouse is picked. Stock
 * badges show tenant-wide availability instead.
 */
export function usePurchaseCatalogue(
  open: boolean,
  token: string,
  quantities: Record<string, number> = {},
) {
  return useSalesCatalogue(
    open,
    token,
    undefined,
    undefined,
    quantities,
    loadPurchaseCataloguePage,
  );
}
