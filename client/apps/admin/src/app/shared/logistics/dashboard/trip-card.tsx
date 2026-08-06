'use client';

import { useState } from 'react';
import { Badge, Button, Select, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiCaretDownBold, PiTruckDuotone } from 'react-icons/pi';
import StopRow from './stop-row';
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_LABEL,
  driverName,
  isEditable,
  isOnTheRoad,
  naira,
} from '../format';
import type { Delivery, DeliveryStop, Driver } from '../types';

interface TripCardProps {
  delivery: Delivery;
  drivers: Driver[];
  onAssignDriver: (deliveryId: string, driverId: string | null) => void;
  onDispatch: (deliveryId: string) => void;
  onResolveStop: (
    delivery: Delivery,
    stop: DeliveryStop,
    status: 'delivered' | 'failed'
  ) => void;
  onComplete: (deliveryId: string) => void;
  onCancel: (deliveryId: string) => void;
  className?: string;
}

export default function TripCard({
  delivery,
  drivers,
  onAssignDriver,
  onDispatch,
  onResolveStop,
  onComplete,
  onCancel,
  className,
}: TripCardProps) {
  const [expanded, setExpanded] = useState(true);

  const editable = isEditable(delivery);
  const onRoad = isOnTheRoad(delivery);
  const resolved = delivery.stops.filter((s) => s.status !== 'pending').length;
  const allResolved =
    delivery.stops.length > 0 && resolved === delivery.stops.length;

  // Only riders who are free, plus whoever is already on this trip.
  const currentDriverId =
    typeof delivery.driver === 'string'
      ? delivery.driver
      : delivery.driver?._id;
  const driverOptions = [
    { label: 'Unassigned', value: '' },
    ...drivers
      .filter((d) => d.status === 'available' || d._id === currentDriverId)
      .map((d) => ({
        label: `${d.name}${d.vehicle?.type ? ` · ${d.vehicle.type}` : ''}`,
        value: d._id,
      })),
  ];

  return (
    <div
      className={cn(
        'rounded-lg border border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-muted p-4">
        <PiTruckDuotone className="h-5 w-5 shrink-0 text-primary" />

        <div className="min-w-0">
          <Title as="h4" className="text-sm font-semibold">
            {delivery.deliveryNumber}
          </Title>
          <Text className="text-xs text-gray-500">
            {driverName(delivery)}
            {delivery.zoneLabel ? ` · ${delivery.zoneLabel}` : ''}
          </Text>
        </div>

        <Badge
          variant="flat"
          size="sm"
          color={DELIVERY_STATUS_COLOR[delivery.status]}
          className="shrink-0"
        >
          {DELIVERY_STATUS_LABEL[delivery.status]}
        </Badge>

        <div className="ms-auto flex items-center gap-3">
          <Text className="text-xs text-gray-500">
            {resolved}/{delivery.stops.length} stops
          </Text>

          {delivery.totals.codExpectedTotal > 0 ? (
            <Badge variant="outline" size="sm" color="warning">
              COD {naira(delivery.totals.codExpectedTotal)}
            </Badge>
          ) : null}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse trip' : 'Expand trip'}
            className="rounded p-1 hover:bg-gray-100"
          >
            <PiCaretDownBold
              className={cn(
                'h-3.5 w-3.5 transition-transform',
                !expanded && '-rotate-90'
              )}
            />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="p-4">
          {editable ? (
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Select
                size="sm"
                label="Driver"
                labelClassName="text-xs"
                options={driverOptions}
                value={currentDriverId ?? ''}
                onChange={(value: string) =>
                  onAssignDriver(delivery._id, value || null)
                }
                getOptionValue={(o) => (o as { value: string }).value}
                displayValue={(value) =>
                  driverOptions.find((o) => o.value === value)?.label ??
                  'Unassigned'
                }
                className="w-56"
              />
            </div>
          ) : null}

          <ul className="divide-y divide-muted">
            {delivery.stops.map((stop, i) => (
              <StopRow
                key={stop._id}
                stop={stop}
                index={i}
                onResolve={
                  onRoad
                    ? (s, status) => onResolveStop(delivery, s, status)
                    : undefined
                }
              />
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-muted pt-4">
            {delivery.status === 'assigned' ? (
              <Button size="sm" onClick={() => onDispatch(delivery._id)}>
                Dispatch trip
              </Button>
            ) : null}

            {delivery.status === 'draft' ? (
              <Text className="text-xs text-gray-500">
                Assign a driver to dispatch this trip.
              </Text>
            ) : null}

            {onRoad ? (
              <Button
                size="sm"
                disabled={!allResolved}
                onClick={() => onComplete(delivery._id)}
                title={allResolved ? undefined : 'Resolve every stop first'}
              >
                Complete trip
              </Button>
            ) : null}

            {editable ? (
              <Button
                size="sm"
                variant="text"
                color="danger"
                onClick={() => onCancel(delivery._id)}
              >
                Cancel trip
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
