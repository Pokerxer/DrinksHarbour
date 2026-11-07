import type React from 'react';
import * as Icon from 'react-icons/pi';

const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType }> = {
  partially_shipped: { color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', icon: Icon.PiTruckBold },
  pending:    { color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  icon: Icon.PiClockBold },
  confirmed:  { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: Icon.PiCheckCircleBold },
  processing: { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: Icon.PiPackageBold },
  shipped:    { color: 'text-purple-700', bg: 'bg-purple-50',  border: 'border-purple-200', icon: Icon.PiTruckBold },
  delivered:  { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: Icon.PiCheckCircleBold },
  cancelled:  { color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: Icon.PiXCircleBold },
  refunded:   { color: 'text-stone-600',  bg: 'bg-stone-50',   border: 'border-stone-200',  icon: Icon.PiArrowCounterClockwiseBold },
};

export const STEPS = [
  { key: 'pending',    label: 'Order Placed', sub: 'Order recorded',   icon: Icon.PiShoppingCartBold },
  { key: 'confirmed',  label: 'Confirmed',    sub: 'Merchant acknowledged', icon: Icon.PiCheckCircleBold },
  { key: 'processing', label: 'Packing',      sub: 'Items being prepared',icon: Icon.PiPackageBold },
  { key: 'shipped',    label: 'On the Way',   sub: 'Recorded as shipped',    icon: Icon.PiTruckBold },
  { key: 'delivered',  label: 'Delivered',    sub: 'Recorded as delivered',      icon: Icon.PiHouseBold },
];

export const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

export const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function getCfg(status: string) {
  return STATUS_CFG[status?.toLowerCase()] || STATUS_CFG.pending;
}

