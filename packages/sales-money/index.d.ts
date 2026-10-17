export interface MoneyLine {
  lineType?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  discountType?: string;
  taxRate?: number;
  promoDiscount?: number;
}
export interface DocumentAmounts {
  subtotal?: number;
  discountTotal?: number;
  promotionTotal?: number;
  taxTotal?: number;
  couponDiscount?: number;
  pricelistCartDiscount?: number;
  shippingFee?: number;
}
export function money(value: number): number;
export function lineAmounts(line: MoneyLine): {
  gross: number;
  discount: number;
  promotion: number;
  afterDiscount: number;
  untaxed: number;
  tax: number;
  total: number;
};
export function convertDiscount(
  line: MoneyLine,
  discountType: "fixed" | "percentage",
): { discountType: "fixed" | "percentage"; discount: number };
export function documentAmounts(lines: MoneyLine[]): {
  subtotal: number;
  discountTotal: number;
  promotionTotal: number;
  taxTotal: number;
  untaxed: number;
  total: number;
};
export function documentTotal(amounts: DocumentAmounts): number;
