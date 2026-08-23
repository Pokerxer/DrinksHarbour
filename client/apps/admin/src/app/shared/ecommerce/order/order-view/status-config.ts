import {
  PiCheckBold,
  PiClockBold,
  PiSealCheckBold,
  PiGearBold,
  PiTruckBold,
  PiHouseBold,
  PiXCircleBold,
  PiArrowBendUpLeftBold,
  PiPauseCircleBold,
} from 'react-icons/pi';
import type { Order } from '@/services/order.service';
import type { OrderTimestampKey } from './format';

// Ordered lifecycle. Terminal states (cancelled / refunded / hold) are rendered
// as their own card instead — they are not points on this line.
export const STATUS_STEPS = [
  {
    key: 'pending',
    label: 'Order Placed',
    description: 'Awaiting confirmation',
    tsKey: 'placedAt',
    Icon: PiClockBold,
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    description: 'Order accepted',
    tsKey: 'confirmedAt',
    Icon: PiSealCheckBold,
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Being packed & prepared',
    tsKey: 'processingAt',
    Icon: PiGearBold,
  },
  {
    key: 'shipped',
    label: 'Shipped',
    description: 'Out for delivery',
    tsKey: 'shippedAt',
    Icon: PiTruckBold,
  },
  {
    key: 'delivered',
    label: 'Delivered',
    description: 'Received by customer',
    tsKey: 'deliveredAt',
    Icon: PiHouseBold,
  },
] as const satisfies readonly {
  key: string;
  label: string;
  description: string;
  tsKey: OrderTimestampKey;
  Icon: React.ElementType;
}[];

/** Statuses that sit off the happy path and get a dedicated card. Without this,
 *  a refunded or on-hold order fell through `findIndex → -1 → 0` and rendered
 *  as though it were still sitting at "Order Placed". */
export const TERMINAL_STATES: Record<
  string,
  {
    label: string;
    tone: string;
    Icon: React.ElementType;
    tsKey?: OrderTimestampKey;
  }
> = {
  cancelled: {
    label: 'Order Cancelled',
    tone: 'text-red-600',
    Icon: PiXCircleBold,
    tsKey: 'cancelledAt',
  },
  refunded: {
    label: 'Order Refunded',
    tone: 'text-blue-600',
    Icon: PiArrowBendUpLeftBold,
  },
  hold: { label: 'On Hold', tone: 'text-gray-600', Icon: PiPauseCircleBold },
};

export const NEXT_STATUS: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'shipped',
  partially_shipped: 'shipped',
  shipped: 'delivered',
};

export const NEXT_LABEL: Record<string, string> = {
  pending: 'Confirm Order',
  confirmed: 'Mark Processing',
  processing: 'Mark Shipped',
  partially_shipped: 'Mark Fully Shipped',
  shipped: 'Mark Delivered',
};

/** The check icon shown on completed steps — kept here so the stepper module
 *  doesn't own the visual vocabulary of the lifecycle. */
export const StepCheckIcon = PiCheckBold;

export function getStatusIndex(status: string) {
  // partially_shipped isn't its own step — it sits at the shipped stage.
  if (status === 'partially_shipped')
    return STATUS_STEPS.findIndex((s) => s.key === 'shipped');
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}
