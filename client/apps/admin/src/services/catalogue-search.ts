import type { Product } from '@/app/shared/ecommerce/sub-product/create-edit/components/ProductSearchResults';
import { z } from 'zod';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
const imageSchema = z.object({ url: z.string(), alt: z.string().default('') });
const labelSchema = z
  .union([z.string(), z.object({ name: z.string() })])
  .nullish()
  .transform((value) => value ?? undefined);
const numberSchema = z
  .number()
  .nullish()
  .transform((value) => value ?? undefined);
const productSchema = z
  .object({
    _id: z.string().optional(),
    id: z.string().optional(),
    name: z.string(),
    slug: z.string().optional(),
    type: z.string().optional(),
    brand: labelSchema,
    category: labelSchema,
    images: z.array(imageSchema).optional(),
    primaryImage: imageSchema
      .nullish()
      .transform((value) => value ?? undefined),
    thumbImage: z
      .array(z.union([z.string(), z.object({ url: z.string() })]))
      .optional(),
    barcode: z.string().optional(),
    volumeMl: numberSchema,
    abv: numberSchema,
    status: z.string().optional(),
    matchKind: z.enum(['exact', 'close', 'related']).optional(),
    matchReason: z.string().optional(),
  })
  .refine(
    (product) => product._id || product.id,
    'Catalog product identity missing'
  );
const resultSchema = z.object({
  data: z.object({ products: z.array(productSchema) }),
});

export async function searchCatalogueProducts(
  query: string,
  {
    token,
    signal,
    type,
  }: { token: string; signal: AbortSignal; type?: string | null }
): Promise<Product[]> {
  const params = new URLSearchParams({
    q: query.trim().slice(0, 160),
    limit: '15',
    matchMode: 'smart',
  });
  if (type) params.set('type', type.toLowerCase());
  const response = await fetch(
    `${API_URL}/api/products/catalogue-search?${params}`,
    {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  if (!response.ok)
    throw new Error('Could not check the catalog. Please retry.');
  return resultSchema.parse(await response.json()).data.products;
}
