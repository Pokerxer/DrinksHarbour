import type {
  InsightLine,
  SupplierOffer,
} from '@/services/notificationInsights.service';
export interface Selection {
  offerId: string;
  quantity: number;
}
export type Selections = Record<string, Selection>;
export interface OrderGroup {
  key: string;
  vendorId: string;
  vendorName: string;
  currency: string;
  warehouseId: string;
  warehouseName: string;
  estimatedCost: number;
  lines: Array<InsightLine & { selected: SupplierOffer }>;
}
export interface RestockDraft {
  expectedArrival?: string;
  scope: string;
  createdAt: number;
  coverDays: number;
  vendorId: string;
  vendorName: string;
  currency: string;
  warehouseId: string;
  items: Array<{
    key: string;
    offerId: string;
    subProductId: string;
    productName: string;
    sku: string;
    sizeId: string;
    sizeName: string;
    quantity: number;
    packSize: number;
    packQty: number;
    unitPrice: number;
    packPrice: number;
    type: string;
    uom: string;
    taxRate: number;
  }>;
}
export const draftKey = (scope: string) =>
  `drinksharbour:restock-draft:${scope}`;
export function validQuantity(quantity: number, offer: SupplierOffer) {
  return (
    Number.isSafeInteger(offer.packagingQty) &&
    offer.packagingQty > 0 &&
    Number.isFinite(offer.minQuantity) &&
    offer.minQuantity >= 0 &&
    (offer.maxQuantity === null ||
      (Number.isFinite(offer.maxQuantity) &&
        offer.maxQuantity >= offer.minQuantity)) &&
    Number.isSafeInteger(quantity) &&
    quantity >= 0 &&
    (quantity === 0 ||
      (quantity >= offer.minQuantity &&
        quantity % offer.packagingQty === 0 &&
        (offer.maxQuantity === null || quantity <= offer.maxQuantity)))
  );
}
export function selectedGroups(
  lines: InsightLine[],
  choices: Selections
): OrderGroup[] {
  const groups = new Map<string, OrderGroup>();
  const seen = new Set<string>();
  for (const line of lines) {
    if (line.summary || !line.warehouseId || seen.has(line.key)) continue;
    seen.add(line.key);
    const choice = choices[line.key],
      offer = choice
        ? line.alternatives?.find((o) => o.offerId === choice.offerId)
        : line.selected;
    if (
      !offer ||
      !offer.vendorId ||
      !['NGN', 'USD', 'EUR', 'GBP'].includes(offer.currency) ||
      !Number.isFinite(offer.unitPrice) ||
      offer.unitPrice < 0
    )
      continue;
    const quantity = choice?.quantity ?? offer.quantity;
    if (!validQuantity(quantity, offer) || quantity === 0) continue;
    const selected = {
      ...offer,
      quantity,
      packs: quantity / offer.packagingQty,
      estimatedCost: Math.round(quantity * offer.unitPrice * 100) / 100,
    };
    const key = `${offer.vendorId}:${offer.currency}:${line.warehouseId}`;
    const group = groups.get(key) || {
      key,
      vendorId: offer.vendorId,
      vendorName: offer.vendorName,
      currency: offer.currency,
      warehouseId: line.warehouseId,
      warehouseName: line.warehouseName,
      estimatedCost: 0,
      lines: [],
    };
    group.lines.push({ ...line, selected });
    group.estimatedCost =
      Math.round((group.estimatedCost + selected.estimatedCost) * 100) / 100;
    groups.set(key, group);
  }
  return Array.from(groups.values());
}
export function prepareDraft(
  group: OrderGroup,
  scope: string,
  now = Date.now(),
  coverDays = 14
): RestockDraft {
  if (
    !scope ||
    !group.warehouseId ||
    !group.lines.length ||
    group.lines.length > 500
  )
    throw new Error('Select up to 500 products and a receiving warehouse.');
  const identities = new Set<string>();
  if (
    !group.vendorId ||
    ![7, 14, 30].includes(coverDays) ||
    !Number.isFinite(now) ||
    group.lines.some((l) => {
      const o = l.selected;
      const identity = `${l.subProductId}:${l.sizeId}`;
      const duplicate = identities.has(identity);
      identities.add(identity);
      return (
        duplicate ||
        l.summary ||
        !l.subProductId ||
        !l.sizeId ||
        l.warehouseId !== group.warehouseId ||
        !o ||
        o.vendorId !== group.vendorId ||
        o.currency !== group.currency ||
        !o.offerId ||
        !validQuantity(o.quantity, o) ||
        o.quantity <= 0 ||
        !Number.isFinite(o.unitPrice) ||
        o.unitPrice < 0
      );
    })
  )
    throw new Error(
      'Review supplier, destination and valid product quantities before preparing this purchase.'
    );
  return {
    scope,
    createdAt: now,
    coverDays,
    vendorId: group.vendorId,
    vendorName: group.vendorName,
    currency: group.currency,
    warehouseId: group.warehouseId,
    items: group.lines.map((l) => ({
      key: l.key,
      offerId: l.selected.offerId,
      subProductId: l.subProductId,
      productName: l.productName,
      sku: l.sku,
      sizeId: l.sizeId,
      sizeName: l.sizeName,
      quantity: l.selected.quantity,
      packSize: l.selected.packagingQty,
      packQty: l.selected.quantity / l.selected.packagingQty,
      unitPrice: l.selected.unitPrice,
      packPrice: l.selected.unitPrice * l.selected.packagingQty,
      type: 'unit',
      uom: l.selected.packaging,
      taxRate: 0,
    })),
  };
}
export function readDraft(
  raw: string | null,
  scope: string,
  now = Date.now()
): RestockDraft | null {
  try {
    const d: RestockDraft = JSON.parse(raw || 'null');
    if (
      !d ||
      d.scope !== scope ||
      !Number.isFinite(d.createdAt) ||
      d.createdAt > now ||
      now - d.createdAt > 600000 ||
      ![7, 14, 30].includes(d.coverDays) ||
      typeof d.vendorId !== 'string' ||
      !d.vendorId ||
      typeof d.warehouseId !== 'string' ||
      !d.warehouseId ||
      !Array.isArray(d.items) ||
      !d.items.length ||
      d.items.length > 500 ||
      !['NGN', 'USD', 'EUR', 'GBP'].includes(d.currency) ||
      !d.items.every(
        (i) =>
          i &&
          typeof i.key === 'string' &&
          !!i.key &&
          typeof i.offerId === 'string' &&
          !!i.offerId &&
          typeof i.subProductId === 'string' &&
          !!i.subProductId &&
          typeof i.sizeId === 'string' &&
          !!i.sizeId &&
          Number.isSafeInteger(i.quantity) &&
          i.quantity > 0 &&
          Number.isSafeInteger(i.packSize) &&
          i.packSize > 0 &&
          i.quantity % i.packSize === 0 &&
          i.packQty === i.quantity / i.packSize &&
          Number.isFinite(i.unitPrice) &&
          i.unitPrice >= 0 &&
          i.packPrice === i.unitPrice * i.packSize
      )
    )
      return null;
    if (
      new Set(d.items.map((i) => i.key)).size !== d.items.length ||
      new Set(d.items.map((i) => `${i.subProductId}:${i.sizeId}`)).size !==
        d.items.length
    )
      return null;
    return d;
  } catch {
    return null;
  }
}
