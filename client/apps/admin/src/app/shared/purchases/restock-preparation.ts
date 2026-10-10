import type { SupplierOffer } from '@/services/notificationInsights.service';
import {
  validQuantity,
  type RestockDraft,
} from '../notifications/vendor-orders/order-draft';
export interface RestockPreparation {
  draft: RestockDraft;
  offers: SupplierOffer[];
  coverDays: number;
}
interface PurchaseInput {
  vendorId: string;
  currency: string;
  warehouseId: string;
  items: Array<{
    subProductId: string;
    sizeId?: string;
    quantity: number;
    unitPrice: number;
    packSize: number;
  }>;
}
export function preparedPurchaseReference(
  prepared: RestockPreparation,
  input: PurchaseInput
) {
  const { draft, offers } = prepared;
  if (
    input.vendorId !== draft.vendorId ||
    input.currency !== draft.currency ||
    input.warehouseId !== draft.warehouseId
  )
    throw new Error(
      'Supplier, currency or receiving warehouse changed. Review Vendor orders and prepare the purchase again.'
    );
  if (!input.items.length)
    throw new Error('Keep at least one prepared product.');
  const seen = new Set<string>();
  const lines = input.items.map((item) => {
    const identity = `${item.subProductId}:${item.sizeId}`;
    const original = draft.items.find(
      (i) => i.subProductId === item.subProductId && i.sizeId === item.sizeId
    );
    const offer =
      original && offers.find((o) => o.offerId === original.offerId);
    if (!original || !offer || seen.has(identity))
      throw new Error(
        'A product was added, replaced or duplicated. Review Vendor orders and prepare it again.'
      );
    seen.add(identity);
    if (
      item.packSize !== offer.packagingQty ||
      item.unitPrice !== offer.unitPrice
    )
      throw new Error(
        'Supplier price or pack size changed. Review Vendor orders for current terms.'
      );
    if (item.quantity <= 0 || !validQuantity(item.quantity, offer))
      throw new Error(
        `Review quantity for ${original.productName || 'this product'}: use whole packs of ${offer.packagingQty}, at least ${offer.minQuantity} units${offer.maxQuantity != null ? ` and no more than ${offer.maxQuantity}` : ''}. Remove the product to leave it out.`
      );
    return { key: original.key, offerId: original.offerId };
  });
  return { coverDays: prepared.coverDays, lines };
}
export function arrivalEstimate(offers: SupplierOffer[], now = new Date()) {
  if (
    !offers.length ||
    !Number.isFinite(now.getTime()) ||
    offers.some((o) => !Number.isFinite(o.leadTimeDays) || o.leadTimeDays < 0)
  )
    return '';
  const date = new Date(
    now.getTime() +
      Math.ceil(Math.max(...offers.map((o) => o.leadTimeDays))) * 86400000
  );
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
