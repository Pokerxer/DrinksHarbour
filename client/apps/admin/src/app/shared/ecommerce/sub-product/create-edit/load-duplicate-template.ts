import { z } from 'zod';
import { subproductService } from '@/services/subproduct.service';
import { productService } from '@/services/product.service';
import { buildDuplicateTemplate, relationId } from './duplicate-template';

function responseRecord(response: unknown, key: string): Record<string, unknown> | undefined {
  const envelope = z.object({ data: z.record(z.unknown()) }).safeParse(response);
  if (!envelope.success) return undefined;
  const record = z.record(z.unknown()).safeParse(envelope.data.data[key]);
  return record.success ? record.data : undefined;
}

export async function loadDuplicateTemplate(sourceId: string, token: string) {
  if (!token) throw new Error('Sign in to duplicate a product.');
  // Authorize source-tenant access before reading the linked catalog product.
  const response = await subproductService.getSubProduct(sourceId, token);
  const source = responseRecord(response, 'subProduct');
  if (!source) throw new Error('Source sub-product was not found.');
  const parentId = relationId(source.product);
  if (!parentId) throw new Error('The source product is no longer available.');
  const parent = await productService.getProductById(parentId, token, true);
  const product = responseRecord(parent, 'product');
  if (!product) throw new Error('The source product is no longer available.');
  return buildDuplicateTemplate(source, product);
}
