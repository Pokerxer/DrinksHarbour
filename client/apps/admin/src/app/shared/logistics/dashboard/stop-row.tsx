'use client';

import { Badge, Button, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiMapPinDuotone, PiPhoneDuotone } from 'react-icons/pi';
import { naira, oneLineAddress, shortTime, STOP_STATUS_COLOR } from '../format';
import type { DeliveryStop } from '../types';

interface StopRowProps {
  stop: DeliveryStop;
  index: number;
  /** Absent on trips that are not out on the road yet. */
  onResolve?: (stop: DeliveryStop, status: 'delivered' | 'failed') => void;
}

export default function StopRow({ stop, index, onResolve }: StopRowProps) {
  const order = typeof stop.order === 'string' ? null : stop.order;
  const isPending = stop.status === 'pending';

  return (
    <li className="flex gap-3 py-3">
      <div
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          stop.status === 'delivered' && 'bg-green-lighter text-green-dark',
          stop.status === 'failed' && 'bg-red-lighter text-red-dark',
          isPending && 'bg-gray-100 text-gray-600'
        )}
      >
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <Text className="truncate text-sm font-medium">
            {order?.orderNumber ?? 'Order'}
          </Text>
          <Badge
            variant="flat"
            size="sm"
            color={STOP_STATUS_COLOR[stop.status]}
          >
            {stop.status}
          </Badge>
        </div>

        <Text className="mt-0.5 truncate text-sm text-gray-600">
          {stop.addressSnapshot?.fullName || 'Customer'}
        </Text>

        <div className="mt-1 flex items-start gap-1 text-xs text-gray-500">
          <PiMapPinDuotone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">
            {oneLineAddress(stop.addressSnapshot)}
          </span>
        </div>

        {stop.addressSnapshot?.phone ? (
          <a
            href={`tel:${stop.addressSnapshot.phone}`}
            className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <PiPhoneDuotone className="h-3.5 w-3.5" />
            {stop.addressSnapshot.phone}
          </a>
        ) : null}

        {stop.addressSnapshot?.landmark ? (
          <Text className="mt-1 text-xs italic text-gray-400">
            Landmark: {stop.addressSnapshot.landmark}
          </Text>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {stop.codExpected > 0 ? (
            <Badge variant="flat" size="sm" color="warning">
              Collect {naira(stop.codExpected)}
            </Badge>
          ) : null}

          {stop.status === 'delivered' && stop.codCollected > 0 ? (
            <Badge
              variant="flat"
              size="sm"
              // A short payment is the thing a dispatcher must notice.
              color={
                stop.codCollected < stop.codExpected ? 'danger' : 'success'
              }
            >
              Got {naira(stop.codCollected)}
            </Badge>
          ) : null}

          {stop.deliveredAt ? (
            <Text className="text-xs text-gray-400">
              at {shortTime(stop.deliveredAt)}
            </Text>
          ) : null}
        </div>

        {stop.status === 'failed' && stop.failureReason ? (
          <Text className="mt-1.5 rounded bg-red-lighter/40 px-2 py-1 text-xs text-red-dark">
            {stop.failureReason}
          </Text>
        ) : null}

        {stop.status === 'delivered' && stop.proofOfDelivery?.recipientName ? (
          <Text className="mt-1.5 text-xs text-gray-500">
            Received by {stop.proofOfDelivery.recipientName}
            {stop.proofOfDelivery.note ? ` — ${stop.proofOfDelivery.note}` : ''}
          </Text>
        ) : null}

        {isPending && onResolve ? (
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(stop, 'delivered')}
            >
              Delivered
            </Button>
            <Button
              size="sm"
              variant="text"
              color="danger"
              onClick={() => onResolve(stop, 'failed')}
            >
              Failed
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
