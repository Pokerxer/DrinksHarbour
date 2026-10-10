import {
  applyAvailabilityFromStock,
  resolveCatalogLines,
  scopeIsEmpty,
  type ScopeSelection,
  type CatalogProduct,
  type PricelistLite,
} from './inventory-pricelist-print';
import type { StockRow } from '@/services/warehouseStock.service';

export interface PricelistDetailState {
  status: 'ready' | 'error';
  data?: PricelistLite;
  error?: string;
}
export async function loadPricelistDetails(
  ids: string[],
  get: (id: string) => Promise<unknown>
): Promise<Record<string, PricelistDetailState>> {
  const entries = await Promise.all(
    Array.from(new Set(ids))
      .filter(Boolean)
      .map(async (id) => {
        try {
          const response = (await get(id)) as { data?: PricelistLite };
          if (
            !response.data ||
            response.data._id !== id ||
            !Array.isArray(response.data.rules)
          )
            throw new Error('Full pricelist rules were not returned');
          return [id, { status: 'ready', data: response.data }] as const;
        } catch (error) {
          return [
            id,
            {
              status: 'error',
              error:
                error instanceof Error ? error.message : 'Could not load rules',
            },
          ] as const;
        }
      })
  );
  return Object.fromEntries(entries);
}
export function resolveExportRows(
  mode: 'current' | 'select',
  scope: ScopeSelection,
  catalog: CatalogProduct[],
  rows: StockRow[]
) {
  if (mode === 'current') return rows;
  if (scopeIsEmpty(scope)) return [];
  return applyAvailabilityFromStock(resolveCatalogLines(catalog, scope), rows);
}
