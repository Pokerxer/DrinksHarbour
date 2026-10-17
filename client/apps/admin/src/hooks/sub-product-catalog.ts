import { subproductService } from '@/services/subproduct.service';
import { z } from 'zod';
import type {
  SubProductsPagination,
  SubProductsStats,
} from './use-sub-products';

interface CatalogResponse {
  success: boolean;
  message?: string;
  data?: {
    subProducts: Record<string, unknown>[];
    pagination?: SubProductsPagination;
    stats?: SubProductsStats;
  };
}

const catalogResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      subProducts: z.array(z.record(z.unknown())),
      pagination: z
        .object({
          page: z.number().int().default(1),
          limit: z.number().default(5000),
          total: z.number().nonnegative(),
          pages: z.number().int().nonnegative(),
          hasNext: z.boolean().default(false),
          hasPrev: z.boolean().default(false),
        })
        .optional(),
      stats: z
        .object({
          total: z.number(),
          active: z.number(),
          lowStock: z.number(),
          outOfStock: z.number(),
        })
        .optional(),
    })
    .optional(),
});

/** Read every authorized page before exposing a client-filtered catalog. */
export async function loadSubProductCatalog(
  token: string,
  fresh: boolean,
  isCurrent: () => boolean
): Promise<CatalogResponse | null> {
  const params = {
    limit: 5000,
    view: 'list',
    ...(fresh ? { refresh: 'true' } : {}),
  };
  const first = catalogResponseSchema.parse(
    await subproductService.getSubProducts(token, params)
  );
  if (!isCurrent()) return null;
  if (!first.success || !first.data?.pagination) return first;
  const pages = first.data.pagination.pages;
  if (!Number.isSafeInteger(pages) || pages < 0)
    throw new Error('Invalid catalog pagination. Please retry.');
  const items = [...first.data.subProducts];
  for (let page = 2; page <= pages; page++) {
    const response = catalogResponseSchema.parse(
      await subproductService.getSubProducts(token, { ...params, page })
    );
    if (!isCurrent()) return null;
    if (!response.success || !response.data)
      throw new Error(
        response.message || 'Could not load the complete catalog. Please retry.'
      );
    items.push(...response.data.subProducts);
  }
  const seen = new Set<string>();
  const unique = items.filter((item) => {
    const id = String(item._id || item.id || '');
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return {
    ...first,
    data: {
      ...first.data,
      subProducts: unique,
      pagination: {
        page: 1,
        limit: unique.length,
        total: unique.length,
        pages: 1,
        hasNext: false,
        hasPrev: false,
      },
    },
  };
}
