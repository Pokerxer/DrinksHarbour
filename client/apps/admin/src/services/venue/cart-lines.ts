type CartLine = { subProductId: string; sizeId?: string; quantity: number; price?: number; discount?: number; comboRef?: unknown; bxgyRef?: unknown };
export function venueCartLines(items: CartLine[], discountValue = 0, rewards: readonly unknown[] = []) {
  if (discountValue || rewards.length || items.some(item => item.discount || item.comboRef || item.bxgyRef)) throw new Error('Unsupported venue cart rule. Remove discounts, rewards and bundles before saving this visit.');
  if (items.some(item => !item.sizeId)) throw new Error('Choose a stock size for every venue beverage.');
  return items.map(item => ({ subProductId: item.subProductId, sizeId: item.sizeId!, quantity: item.quantity }));
}
