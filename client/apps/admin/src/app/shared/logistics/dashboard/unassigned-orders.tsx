'use client';

import { Badge, Button, Checkbox, Empty, Select, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';
import { PiMapPinDuotone, PiPlusBold } from 'react-icons/pi';
import { naira, oneLineAddress, waitingFor } from '../format';
import type { DashboardData, UnassignedOrder } from '../types';

interface UnassignedOrdersProps {
  orders: UnassignedOrder[];
  selected: string[];
  onToggle: (orderId: string) => void;
  onSelectAll: () => void;
  onCreateTrip: () => void;
  zone: string;
  onZoneChange: (zone: string) => void;
  zones: DashboardData['zones'];
  loading?: boolean;
  className?: string;
}

export default function UnassignedOrders({
  orders,
  selected,
  onToggle,
  onSelectAll,
  onCreateTrip,
  zone,
  onZoneChange,
  zones,
  loading,
  className,
}: UnassignedOrdersProps) {
  const zoneOptions = [
    { label: 'All zones', value: '' },
    ...zones.map((z) => ({ label: `${z.label} (${z.count})`, value: z.zone })),
  ];

  const allSelected = orders.length > 0 && selected.length === orders.length;

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      <div className="border-b border-muted p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Title as="h3" className="text-base font-semibold">
            Awaiting dispatch
            <Badge variant="flat" color="secondary" size="sm" className="ms-2">
              {orders.length}
            </Badge>
          </Title>

          <Button
            size="sm"
            disabled={selected.length === 0}
            onClick={onCreateTrip}
            className="shrink-0"
          >
            <PiPlusBold className="me-1.5 h-3.5 w-3.5" />
            Build trip
            {selected.length > 0 ? ` (${selected.length})` : ''}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Select
            size="sm"
            options={zoneOptions}
            value={zone}
            onChange={(value: string) => onZoneChange(value)}
            getOptionValue={(o) => (o as { value: string }).value}
            displayValue={(value) =>
              zoneOptions.find((o) => o.value === value)?.label ?? 'All zones'
            }
            className="w-44"
          />

          {orders.length > 0 ? (
            <Checkbox
              size="sm"
              label="Select all"
              checked={allSelected}
              onChange={onSelectAll}
            />
          ) : null}
        </div>
      </div>

      <div className="max-h-[32rem] flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <Text className="text-sm text-gray-500">Loading orders…</Text>
          </div>
        ) : orders.length === 0 ? (
          <Empty
            className="p-8"
            text={
              zone
                ? 'No orders waiting in this zone'
                : 'Nothing waiting to go out'
            }
            textClassName="text-sm text-gray-500"
          />
        ) : (
          <ul className="divide-y divide-muted">
            {orders.map((order) => {
              const isSelected = selected.includes(order._id);
              return (
                <li
                  key={order._id}
                  className={cn(
                    'flex gap-3 p-4 transition-colors',
                    isSelected
                      ? 'bg-primary-lighter/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-100'
                  )}
                >
                  <Checkbox
                    size="sm"
                    className="mt-1"
                    checked={isSelected}
                    onChange={() => onToggle(order._id)}
                    aria-label={`Select order ${order.orderNumber}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <Text className="truncate font-medium">
                        {order.orderNumber}
                      </Text>
                      <Text className="shrink-0 text-xs text-gray-400">
                        {waitingFor(order.placedAt)}
                      </Text>
                    </div>

                    <Text className="mt-0.5 truncate text-sm text-gray-600">
                      {order.shippingAddress?.fullName || 'Customer'}
                    </Text>

                    <div className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                      <PiMapPinDuotone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="line-clamp-1">
                        {oneLineAddress(order.shippingAddress)}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {/* A second attempt, not a fresh order — worth spotting
                          before it gets batched onto the far side of town. */}
                      {order.isRedelivery ? (
                        <Badge variant="flat" size="sm" color="danger">
                          Retry
                        </Badge>
                      ) : null}

                      {order.shippingInfo?.zoneLabel ? (
                        <Badge variant="outline" size="sm" color="secondary">
                          {order.shippingInfo.zoneLabel}
                        </Badge>
                      ) : null}

                      {/* Only flagged when money is still owed at the door. */}
                      {order.codExpected > 0 ? (
                        <Badge variant="flat" size="sm" color="warning">
                          Collect {naira(order.codExpected)}
                        </Badge>
                      ) : (
                        <Badge variant="flat" size="sm" color="success">
                          Paid
                        </Badge>
                      )}

                      <Text className="ms-auto text-xs font-medium text-gray-700">
                        {naira(order.totalAmount)}
                      </Text>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
