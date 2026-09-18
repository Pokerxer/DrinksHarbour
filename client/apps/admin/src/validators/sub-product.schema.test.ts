import { describe, it, expect } from 'vitest';
import { subProductFormSchema } from './sub-product.schema';

const base = {
  subProductData: {
    product: '507f1f77bcf86cd799439011',
    createNewProduct: false,
    costPrice: 500,
    sellWithoutSizeVariants: false,
    sizes: [] as { size?: string }[],
  },
};

function sizeIssues(res: {
  success: boolean;
  error?: { issues: { path: (string | number)[] }[] };
}) {
  if (res.success || !res.error) return [];
  return res.error.issues.filter((i) =>
    i.path.join('.').startsWith('subProductData.sizes')
  );
}

describe('subProductFormSchema — size rules respect the toggle', () => {
  it('rejects a row with an empty size when selling WITH variants', () => {
    const res = subProductFormSchema.safeParse({
      subProductData: {
        ...base.subProductData,
        sizes: [{ size: '' }, { size: '50cl' }],
      },
    });
    expect(res.success).toBe(false);
    expect(sizeIssues(res)).toHaveLength(1);
  });

  it('allows incomplete hidden rows when selling WITHOUT variants', () => {
    const res = subProductFormSchema.safeParse({
      subProductData: {
        ...base.subProductData,
        sellWithoutSizeVariants: true,
        sizes: [{ size: '' }, { size: '' }, { size: '1L' }],
      },
    });
    expect(res.success).toBe(true);
    expect(sizeIssues(res)).toHaveLength(0);
  });

  it('accepts complete rows when selling WITH variants', () => {
    const res = subProductFormSchema.safeParse({
      subProductData: {
        ...base.subProductData,
        sizes: [{ size: '50cl' }, { size: '1L' }],
      },
    });
    expect(res.success).toBe(true);
  });
});