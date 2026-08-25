import type { CartPendingCode } from '@/app/shared/point-of-sale/store';

export type PaymentLine = {
  id: string;
  method: string;
  label: string;
  amount: number;
};

// AppliedCode is the same shape as CartPendingCode — one canonical type
export type AppliedCode = CartPendingCode;

export interface AppliedDiscount {
  id: string;
  name: string;
  kind: 'code' | 'promotion' | 'bxgy';
  discount: number; // ₦ amount
  color?: string;
  detail?: string; // human-readable e.g. "10% off order"
}
