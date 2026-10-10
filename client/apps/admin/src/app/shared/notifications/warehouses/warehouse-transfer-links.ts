export function transferPreparationHref(
  productId: string,
  sizeId: string,
  destinationId: string,
  sourceId: string,
  quantity: number,
  coverDays: number
) {
  const query = new URLSearchParams({
    warehouseRecommendation: '1',
    sourceWarehouseId: sourceId,
    destinationWarehouseId: destinationId,
    subProductId: productId,
    sizeId,
    quantity: String(quantity),
    coverDays: String(coverDays),
  });
  return `/purchases/transfers/create?${query}`;
}
