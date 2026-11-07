interface OrderItem {
  product: { _id: string; name: string; slug: string; images: { url: string; alt: string }[] };
  subproduct?: { name: string; images?: string[] };
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  size?: { displayName?: string; size?: string };
}

export interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  subtotal: number;
  shippingFee: number;
  discountTotal: number;
  totalAmount: number;
  placedAt: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    country: string;
    postalCode?: string;
    phone: string;
  };
}

