export interface SalesTotalsCoupon {
  code: string;
  name: string;
  discount: number;
}

export interface SalesTotalsProps {
  untaxedAmount: number;
  /** Total discount (resolved ₦) across product lines; 0 hides the row. */
  discountTotal?: number;
  promotionTotal?: number;
  taxTotal: number;
  grandTotal: number;
  currency?: string;
  /** Footer adjustments — all optional so read-only contexts can omit them. */
  coupon?: SalesTotalsCoupon | null;
  couponBusy?: boolean;
  /** Cart spend-threshold discount (cart_threshold pricelist rules); 0 hides the row. */
  pricelistCartDiscount?: number;
  /** Pricelist name shown next to the spend-discount row. */
  pricelistName?: string;
  onApplyCoupon?: (code: string) => void | Promise<void>;
  onClearCoupon?: () => void | Promise<void>;
  shippingFee?: number;
  onShippingChange?: (fee: number) => void;
  onApplyDiscount?: (pct: number) => void;
  /** Loyalty points of the selected customer; null/undefined hides Reward. */
  customerPoints?: number | null;
  plannedRedeemPoints?: number;
  onRedeemPointsChange?: (pts: number) => void;
  /** Jump to the Terms field (Other Info tab). */
  onOpenTerms?: () => void;
}
