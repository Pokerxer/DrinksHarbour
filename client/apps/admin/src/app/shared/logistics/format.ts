import type { AddressSnapshot, Delivery, DeliveryStatus, DriverStatus, StopStatus } from './types';

export function naira(value: number | null | undefined): string {
  return `₦${Number(value || 0).toLocaleString()}`;
}

/** Hours as a human span. Deliveries are usually sub-day, so minutes matter. */
export function durationFromHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
}

export function oneLineAddress(address: AddressSnapshot | undefined): string {
  if (!address) return '—';
  return [address.addressLine1, address.addressLine2, address.city, address.state]
    .filter(Boolean)
    .join(', ');
}

export function shortTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** How long an order has been waiting, for triage in the queue. */
export function waitingFor(placedAt: string | undefined): string {
  if (!placedAt) return '';
  const hours = (Date.now() - new Date(placedAt).getTime()) / 36e5;
  if (hours < 1) return `${Math.round(hours * 60)}m ago`;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  dispatched: 'Dispatched',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

// rizzui Badge colors.
export const DELIVERY_STATUS_COLOR: Record<
  DeliveryStatus,
  'primary' | 'secondary' | 'danger' | 'info' | 'success' | 'warning'
> = {
  draft: 'secondary',
  assigned: 'info',
  dispatched: 'primary',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
};

export const DRIVER_STATUS_LABEL: Record<DriverStatus, string> = {
  available: 'Available',
  on_trip: 'On trip',
  off_duty: 'Off duty',
  suspended: 'Suspended',
};

export const DRIVER_STATUS_COLOR: Record<
  DriverStatus,
  'primary' | 'secondary' | 'danger' | 'info' | 'success' | 'warning'
> = {
  available: 'success',
  on_trip: 'primary',
  off_duty: 'secondary',
  suspended: 'danger',
};

export const STOP_STATUS_COLOR: Record<StopStatus, 'secondary' | 'success' | 'danger'> = {
  pending: 'secondary',
  delivered: 'success',
  failed: 'danger',
};

export function driverName(delivery: Delivery): string {
  const { driver } = delivery;
  if (!driver) return 'Unassigned';
  return typeof driver === 'string' ? 'Assigned' : driver.name;
}

/** Trips a dispatcher can still edit before hand-over. */
export function isEditable(delivery: Delivery): boolean {
  return delivery.status === 'draft' || delivery.status === 'assigned';
}

/** Trips currently out with a rider. */
export function isOnTheRoad(delivery: Delivery): boolean {
  return delivery.status === 'dispatched' || delivery.status === 'in_progress';
}
