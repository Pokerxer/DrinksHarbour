// Typed models for the POS pricelists module.
export interface SubProductLite {
  _id: string;
  sku?: string;
  product?: { _id?: string; name?: string } | string;
  baseSellingPrice?: number;
  costPrice?: number;
  isOnSale?: boolean;
  saleType?: 'percentage' | 'fixed';
  saleDiscountValue?: number;
  flashSale?: { isActive?: boolean; discountPercentage?: number };
  bundleDeals?: unknown[];
}

export type PriceRuleType =
  | 'discount'
  | 'flash_sale'
  | 'fixed'
  | 'formula'
  | 'bundle'
  | 'cart_threshold';

export interface PricelistRule {
  _id: string;
  subProduct?: SubProductLite | string;
  appliedOn?: string;
  priceType: PriceRuleType;
  discountType?: 'percentage' | 'fixed';
  discountPercentage?: number;
  discountAmount?: number;
  fixedPrice?: number;
  markupPercentage?: number;
  flashSalePercentage?: number;
  flashSaleQty?: number;
  bundleName?: string;
  bundleQuantity?: number;
  bundleDiscount?: number;
  bundleDiscountType?: 'percentage' | 'fixed' | 'markup_on_cost' | 'no_discount';
  bundleTargetSubProduct?: SubProductLite | string;
  thresholdAmount?: number;
  minQuantity?: number;
  startDate?: string;
  endDate?: string;
}

export interface Pricelist {
  _id: string;
  name: string;
  currency?: string;
  website?: string;
  isSelectable?: boolean;
  isDefault?: boolean;
  shops?: string[];
  warehouses?: Array<string | { _id?: string; name?: string }>;
  customerTags?: string[];
  countryGroups?: string[];
  rules?: PricelistRule[];
}

/** Loose shape of the rule form while editing — all values strings for controlled inputs. */
export interface RuleFormValues {
  applyTo: 'product' | 'all';
  subProduct: string;
  appliedOn: string;
  priceType: PriceRuleType;
  fixedPrice: string;
  markupPercentage: string;
  discountType: 'percentage' | 'fixed';
  discountPercentage: string;
  discountAmount: string;
  flashSalePercentage: string;
  flashSaleQty: string;
  bundleName: string;
  bundleQuantity: string;
  bundleDiscount: string;
  bundleDiscountType: 'percentage' | 'fixed' | 'markup_on_cost' | 'no_discount';
  bundleTargetSubProduct: string;
  bundleTargetName: string;
  thresholdAmount: string;
  minQuantity: string;
  startDate: string;
  endDate: string;
}
