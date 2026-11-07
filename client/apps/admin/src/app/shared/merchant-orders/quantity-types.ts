export type QuantityRow = {
  _id: string;
  version: number;
  state: string;
  lines: {
    line: string;
    quantity: number;
    productName?: string;
    sizeName?: string;
    sku?: string;
  }[];
  quantityProgress?: {
    line: string;
    shipped: number;
    delivered: number;
    cancelled: number;
    financialBlocks: { start: number; quantity: number; kind: string }[];
  }[];
};
export type QuantitySave = (
  path: string,
  payload: Record<string, unknown>,
  identity: string
) => Promise<boolean>;
export type GoodsAllocation = {
  deliveryManaged?: boolean;
  _id: string;
  state: 'shipped' | 'delivered';
  lines: {
    line: string;
    quantity: number;
    ranges: { start: number; quantity: number }[];
  }[];
};
