import {
  PiCheckCircle,
  PiCircleHalf,
  PiClock,
  PiMinusCircle,
} from 'react-icons/pi';

const states = {
  paid: {
    label: 'Paid',
    Icon: PiCheckCircle,
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  partial: {
    label: 'Partially paid',
    Icon: PiCircleHalf,
    classes: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  unpaid: {
    label: 'Unpaid',
    Icon: PiClock,
    classes: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  closed: {
    label: 'Payment closed',
    Icon: PiMinusCircle,
    classes: 'border-gray-200 bg-gray-100 text-gray-600',
  },
  unknown: {
    label: 'Payment status unavailable',
    Icon: PiMinusCircle,
    classes: 'border-gray-200 bg-gray-50 text-gray-600',
  },
};
export default function PaymentStatusBadge({
  status,
  closed = false,
}: {
  status: string;
  closed?: boolean;
}) {
  const state = closed
    ? states.closed
    : status === 'paid'
      ? states.paid
      : status === 'partial'
        ? states.partial
        : status === 'unpaid'
          ? states.unpaid
          : states.unknown;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-4 ${state.classes}`}
    >
      <state.Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
      <span>{state.label}</span>
    </span>
  );
}
