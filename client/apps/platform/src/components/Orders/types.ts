export interface ShipmentItem {
  line: string;
  name: string;
  quantity: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}
export interface ShipmentGroup {
  id: string;
  merchantName: string;
  status: string;
  items: ShipmentItem[];
  shipments: {
    id: string;
    method: "pickup" | "local_delivery" | "merchant" | "carrier";
    status: string;
    items: { line: string; quantity: number }[];
  }[];
  refunds: {
    status: "pending" | "processing" | "needs_review" | "completed";
    amountMinor: number;
    currency: string;
  }[];
}
export interface ShipmentProgressData {
  orderId: string;
  managed: boolean;
  groups: ShipmentGroup[];
}
