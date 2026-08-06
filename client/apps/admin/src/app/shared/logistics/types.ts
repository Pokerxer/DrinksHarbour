// Types for the logistics dispatch module. Mirrors server/models/Delivery.js
// and server/models/Driver.js.

export type VehicleType = 'bike' | 'tricycle' | 'car' | 'van' | 'truck';

export type DriverStatus = 'available' | 'on_trip' | 'off_duty' | 'suspended';

export type DeliveryStatus =
  | 'draft'
  | 'assigned'
  | 'dispatched'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type StopStatus = 'pending' | 'delivered' | 'failed';

export interface Driver {
  _id: string;
  tenant: string;
  user?: string | null;
  name: string;
  phone: string;
  email?: string;
  vehicle: {
    type?: VehicleType | '';
    plateNumber?: string;
    capacityKg?: number;
  };
  licenseNumber?: string;
  licenseExpiry?: string | null;
  licenseDocUrl?: string;
  status: DriverStatus;
  currentLocation?: {
    lat: number | null;
    lng: number | null;
    updatedAt: string | null;
  };
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Virtuals
  isAvailable?: boolean;
  vehicleLabel?: string;
}

export interface AddressSnapshot {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  landmark?: string;
  additionalInstructions?: string;
}

/** An order embedded on a stop, as populated by the list/detail endpoints. */
export interface StopOrderRef {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  placedAt?: string;
}

export interface DeliveryStop {
  _id: string;
  order: StopOrderRef | string;
  sequence: number;
  addressSnapshot: AddressSnapshot;
  coordinates: { lat: number | null; lng: number | null };
  zone: string | null;
  zoneLabel: string | null;
  status: StopStatus;
  deliveredAt: string | null;
  failureReason?: string;
  proofOfDelivery?: {
    recipientName?: string;
    note?: string;
    photoUrl?: string;
    capturedAt?: string | null;
  };
  codExpected: number;
  codCollected: number;
}

export interface Delivery {
  _id: string;
  tenant: string;
  deliveryNumber: string;
  driver:
    | Pick<Driver, '_id' | 'name' | 'phone' | 'vehicle' | 'status'>
    | string
    | null;
  status: DeliveryStatus;
  scheduledFor: string | null;
  dispatchedAt: string | null;
  completedAt: string | null;
  zone: string | null;
  zoneLabel: string | null;
  stops: DeliveryStop[];
  totals: {
    stopCount: number;
    distanceKm: number;
    codExpectedTotal: number;
    codCollectedTotal: number;
  };
  codSettlement: {
    status: 'pending' | 'settled';
    amount: number;
    settledAt: string | null;
    settledBy: string | null;
    notes?: string;
  };
  notes?: string;
  cancelledReason?: string;
  createdAt: string;
  updatedAt: string;
  // Virtuals
  resolvedStopCount?: number;
  isFullyResolved?: boolean;
  codOutstanding?: number;
}

/** An order in the unassigned queue, ready to be batched onto a trip. */
export interface UnassignedOrder {
  _id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  placedAt: string;
  shippingMethod?: string;
  shippingAddress?: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    landmark?: string;
    coordinates?: { latitude?: number; longitude?: number };
  };
  shippingInfo?: {
    zone?: string | null;
    zoneLabel?: string | null;
    distanceKm?: number | null;
    daysMax?: number | null;
  };
  codExpected: number;
  /**
   * A previous delivery attempt failed. The order is still 'shipped' — the
   * goods went out and came back — so it needs another run rather than a first.
   */
  isRedelivery?: boolean;
}

export interface DashboardData {
  kpis: {
    awaitingDispatch: number;
    outForDelivery: number;
    deliveredToday: number;
    late: number;
    /** Mean shipped→delivered hours over the last 30 days; null when no sample. */
    avgDeliveryHours: number | null;
    avgDeliverySampleSize: number;
    activeTrips: number;
    codOutstanding: number;
  };
  drivers: Record<DriverStatus, number>;
  zones: { zone: string; label: string; count: number }[];
  methodMix: { method: string; count: number }[];
}

export interface ResolveStopPayload {
  status: 'delivered' | 'failed';
  failureReason?: string;
  codCollected?: number;
  proofOfDelivery?: {
    recipientName?: string;
    note?: string;
    photoUrl?: string;
  };
}

export interface CreateDeliveryPayload {
  orderIds: string[];
  driverId?: string | null;
  scheduledFor?: string | null;
  notes?: string;
}

export type DriverPayload = Partial<
  Pick<
    Driver,
    | 'name'
    | 'phone'
    | 'email'
    | 'vehicle'
    | 'licenseNumber'
    | 'licenseExpiry'
    | 'licenseDocUrl'
    | 'status'
    | 'notes'
  >
>;
