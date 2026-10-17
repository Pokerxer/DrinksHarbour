export interface PurchaseSize {
  stock?: number; availableStock?: number; availability?: string; inStock?: boolean;
  minOrderQuantity?: number; maxOrderQuantity?: number;
}
export function purchaseLimits(size: PurchaseSize | null | undefined) {
  const stock = size?.availableStock ?? size?.stock ?? 0;
  const min = Number.isFinite(size?.minOrderQuantity) ? Math.max(1, Math.ceil(size!.minOrderQuantity!)) : 1;
  const cap = Number.isFinite(size?.maxOrderQuantity) ? Math.max(0, Math.floor(size!.maxOrderQuantity!)) : Infinity;
  const max = Number.isFinite(stock) ? Math.max(0, Math.min(Math.floor(stock), cap)) : 0;
  const canBuy = !!size && size.availability !== 'out_of_stock' && size.inStock !== false && max >= min;
  return { min, max, canBuy };
}
export function clampPurchaseQuantity(quantity: number, limits: ReturnType<typeof purchaseLimits>) {
  if (!limits.canBuy) return 0;
  return Math.min(Math.max(Number.isFinite(quantity) ? Math.floor(quantity) : limits.min, limits.min), limits.max);
}
