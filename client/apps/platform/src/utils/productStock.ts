/** Available quantity takes precedence over physical stock, including zero. */
interface StockSize {
  stock?: number;
  availableStock?: number;
  availability?: string;
  inStock?: boolean;
}
interface StockProduct {
  stockInfo?: { availableStock?: number; totalStock?: number };
  availability?: { status?: string; inStock?: boolean; totalStock?: number };
  availableAt?: Array<{ sizes?: StockSize[] }>;
  availableQuantity?: number;
  quantity?: number;
}

export function isSizeInStock(size?: StockSize | null): boolean {
  if (!size || size.availability === 'out_of_stock' || size.inStock === false) return false;
  return (size.availableStock ?? size.stock ?? 0) > 0;
}

export function isProductInStock(product: StockProduct): boolean {
  if (product.availability?.status === 'out_of_stock' || product.availability?.inStock === false) return false;
  const stock = product.stockInfo?.availableStock ?? product.stockInfo?.totalStock;
  if (stock !== undefined) return stock > 0;
  if (product.availableAt) return product.availableAt.some(store => store.sizes?.some(isSizeInStock));
  return (product.availability?.totalStock ?? product.availableQuantity ?? product.quantity ?? 0) > 0;
}
