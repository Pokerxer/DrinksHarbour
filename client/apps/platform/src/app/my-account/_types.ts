import { type ElementType } from 'react';

export interface OrderItem {
  product?: string | { _id: string; name: string; image?: string; thumbImage?: string[] };
  subproduct?: string;
  size?: string;
  tenant?: string;
  quantity: number;
  priceAtPurchase: number;
  itemSubtotal: number;
  image?: string;
  thumbImage?: string[];
}

export interface ShippingInfo {
  fullName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
}

export interface Order {
  _id: string;
  orderNumber?: string;
  status: string;
  paymentStatus?: string;
  items: OrderItem[];
  totalAmount: number;
  total?: number;
  subtotal?: number;
  shippingFee?: number;
  shipping?: ShippingInfo;
  placedAt?: string;
  createdAt?: string;
}

export interface Address {
  _id: string;
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  street?: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export interface AddressFormData {
  label: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  isDefault: boolean;
}

export interface StatusConfig {
  color: string;
  bg: string;
  border: string;
  icon: ElementType;
}

export interface OrdersResponse {
  data?: { orders?: Order[]; pagination?: PaginationData };
  orders?: Order[];
  pagination?: PaginationData;
}

export interface PaginationData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FiltersState {
  status: string;
  dateFrom: string;
  dateTo: string;
}

export interface NotificationSettings {
  orderUpdates: boolean;
  promotions: boolean;
  newArrivals: boolean;
  newsletter: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  whatsapp: boolean;
}
