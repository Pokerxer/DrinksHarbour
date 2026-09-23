import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDuplicateTemplate } from './load-duplicate-template';
import { subproductService } from '@/services/subproduct.service';
import { productService } from '@/services/product.service';

vi.mock('@/services/subproduct.service', () => ({ subproductService: { getSubProduct: vi.fn() } }));
vi.mock('@/services/product.service', () => ({ productService: { getProductById: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());

describe('duplicate source loading', () => {
  it('reads the authorized source and full catalog details using the current session', async () => {
    vi.mocked(subproductService.getSubProduct).mockResolvedValue({ data: { subProduct: {
      product: { _id: 'parent' }, tenant: 'tenant', costPrice: 2000, sizes: [],
    } } });
    vi.mocked(productService.getProductById).mockResolvedValue({ data: { product: {
      name: 'Full Product', type: 'wine', style: 'dry', producer: 'Producer', region: 'Region',
    } } });
    const result = await loadDuplicateTemplate('source', 'session-token');
    expect(subproductService.getSubProduct).toHaveBeenCalledWith('source', 'session-token');
    expect(productService.getProductById).toHaveBeenCalledWith('parent', 'session-token', true);
    expect(result.subProductData.newProductData).toMatchObject({ name: 'Full Product', producer: 'Producer', region: 'Region' });
  });
  it('stops when source-tenant access is denied', async () => {
    vi.mocked(subproductService.getSubProduct).mockRejectedValue(new Error('Access denied'));
    await expect(loadDuplicateTemplate('other-tenant-source', 'token')).rejects.toThrow('Access denied');
    expect(productService.getProductById).not.toHaveBeenCalled();
  });
  it('refuses to load without authentication', async () => {
    await expect(loadDuplicateTemplate('source', '')).rejects.toThrow('Sign in');
    expect(subproductService.getSubProduct).not.toHaveBeenCalled();
  });
  it('reports a deleted parent instead of producing an empty copy', async () => {
    vi.mocked(subproductService.getSubProduct).mockResolvedValue({ data: { subProduct: { product: null } } });
    await expect(loadDuplicateTemplate('source', 'token')).rejects.toThrow('no longer available');
  });
});
