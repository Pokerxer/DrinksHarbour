'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Text,
  Textarea,
  Title,
} from 'rizzui';
import { naira, oneLineAddress } from '../format';
import type { CreateDeliveryPayload, Driver, UnassignedOrder } from '../types';

interface CreateTripModalProps {
  open: boolean;
  orders: UnassignedOrder[];
  drivers: Driver[];
  onClose: () => void;
  onSubmit: (payload: CreateDeliveryPayload) => void;
  submitting?: boolean;
}

export default function CreateTripModal({
  open,
  orders,
  drivers,
  onClose,
  onSubmit,
  submitting,
}: CreateTripModalProps) {
  const [driverId, setDriverId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setDriverId('');
    setScheduledFor('');
    setNotes('');
  }, [open]);

  const available = drivers.filter((d) => d.status === 'available');
  const driverOptions = [
    { label: 'Assign later', value: '' },
    ...available.map((d) => ({
      label: `${d.name}${d.vehicle?.type ? ` · ${d.vehicle.type}` : ''}`,
      value: d._id,
    })),
  ];

  const codTotal = orders.reduce((sum, o) => sum + (o.codExpected || 0), 0);
  const zones = Array.from(
    new Set(orders.map((o) => o.shippingInfo?.zoneLabel).filter(Boolean))
  ) as string[];

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="p-6">
        <Title as="h3" className="mb-1 text-lg font-semibold">
          Build a trip
        </Title>
        <Text className="mb-5 text-sm text-gray-500">
          {orders.length} stop{orders.length === 1 ? '' : 's'}
          {zones.length ? ` across ${zones.join(', ')}` : ''}
          {codTotal > 0 ? ` · ${naira(codTotal)} to collect` : ''}
        </Text>

        {/* Crossing zones is legal but usually a mistake worth surfacing. */}
        {zones.length > 2 ? (
          <Text className="mb-4 rounded bg-orange-lighter/40 px-3 py-2 text-xs text-orange-dark">
            These stops span {zones.length} zones. Splitting them into separate
            trips is usually faster.
          </Text>
        ) : null}

        <div className="mb-5 max-h-56 overflow-y-auto rounded-lg border border-muted">
          <ol className="divide-y divide-muted">
            {orders.map((order, i) => (
              <li key={order._id} className="flex gap-3 p-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Text className="truncate text-sm font-medium">
                      {order.orderNumber}
                    </Text>
                    <Text className="shrink-0 text-xs text-gray-500">
                      {naira(order.totalAmount)}
                    </Text>
                  </div>
                  <Text className="truncate text-xs text-gray-500">
                    {oneLineAddress(order.shippingAddress)}
                  </Text>
                  {order.codExpected > 0 ? (
                    <Badge
                      variant="flat"
                      size="sm"
                      color="warning"
                      className="mt-1"
                    >
                      Collect {naira(order.codExpected)}
                    </Badge>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-4 @md:grid-cols-2">
          <Select
            label="Driver"
            options={driverOptions}
            value={driverId}
            onChange={(value: string) => setDriverId(value)}
            getOptionValue={(o) => (o as { value: string }).value}
            displayValue={(value) =>
              driverOptions.find((o) => o.value === value)?.label ??
              'Assign later'
            }
            helperText={
              available.length === 0
                ? 'No drivers are free right now'
                : undefined
            }
          />

          <Input
            type="datetime-local"
            label="Scheduled for (optional)"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        </div>

        <Textarea
          label="Notes (optional)"
          className="mt-4"
          placeholder="Anything the rider should know"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={orders.length === 0 || submitting}
            isLoading={submitting}
            onClick={() =>
              onSubmit({
                orderIds: orders.map((o) => o._id),
                driverId: driverId || null,
                scheduledFor: scheduledFor
                  ? new Date(scheduledFor).toISOString()
                  : null,
                notes: notes.trim() || undefined,
              })
            }
          >
            Create trip
          </Button>
        </div>
      </div>
    </Modal>
  );
}
