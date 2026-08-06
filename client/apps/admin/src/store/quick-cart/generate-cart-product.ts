import { CartItem, Product, ProductColor } from '@/types';
import { generateSlug } from '@core/utils/generate-slug';

interface CartProduct extends Omit<Product, 'colors' | 'sizes'> {
  color: ProductColor;
  size: number;
  /** Real backend identifiers — present when the product came from the API. */
  subProductId?: string;
  productId?: string;
  sizeId?: string;
}

export function generateCartProduct(product: CartProduct): CartItem {
  return {
    id: product?.id ?? product?.subProductId ?? product?.productId ?? 0,
    name: product?.title,
    slug: product?.slug ?? generateSlug(product?.title),
    description: product?.description,
    image: product?.thumbnail,
    price: product?.price,
    quantity: 1,
    size: product.size,
    color: product.color,
    // Pass backend identifiers through so checkout can submit a real order
    // against POST /api/orders (which resolves subProductId server-side).
    subProductId: product?.subProductId,
    productId: product?.productId,
    sizeId: product?.sizeId,
  };
}
