'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea, Title } from 'rizzui';
import { DRIVER_STATUS_LABEL } from '../format';
import type {
  Driver,
  DriverPayload,
  DriverStatus,
  VehicleType,
} from '../types';

const VEHICLE_OPTIONS: { label: string; value: VehicleType }[] = [
  { label: 'Bike', value: 'bike' },
  { label: 'Tricycle', value: 'tricycle' },
  { label: 'Car', value: 'car' },
  { label: 'Van', value: 'van' },
  { label: 'Truck', value: 'truck' },
];

// on_trip is set by dispatching, never by hand, so it is not offered here.
const STATUS_OPTIONS: { label: string; value: DriverStatus }[] = [
  { label: DRIVER_STATUS_LABEL.available, value: 'available' },
  { label: DRIVER_STATUS_LABEL.off_duty, value: 'off_duty' },
  { label: DRIVER_STATUS_LABEL.suspended, value: 'suspended' },
];

interface DriverFormModalProps {
  open: boolean;
  driver: Driver | null;
  onClose: () => void;
  onSubmit: (payload: DriverPayload) => void;
  submitting?: boolean;
}

export default function DriverFormModal({
  open,
  driver,
  onClose,
  onSubmit,
  submitting,
}: DriverFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('bike');
  const [plateNumber, setPlateNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [status, setStatus] = useState<DriverStatus>('available');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(driver?.name ?? '');
    setPhone(driver?.phone ?? '');
    setEmail(driver?.email ?? '');
    setVehicleType((driver?.vehicle?.type as VehicleType) || 'bike');
    setPlateNumber(driver?.vehicle?.plateNumber ?? '');
    setLicenseNumber(driver?.licenseNumber ?? '');
    setStatus(
      driver?.status && driver.status !== 'on_trip'
        ? driver.status
        : 'available'
    );
    setNotes(driver?.notes ?? '');
  }, [open, driver]);

  const canSubmit = name.trim().length > 0 && phone.trim().length > 0;
  const isOnTrip = driver?.status === 'on_trip';

  return (
    <Modal isOpen={open} onClose={onClose} size="lg">
      <div className="p-6">
        <Title as="h3" className="mb-5 text-lg font-semibold">
          {driver ? 'Edit rider' : 'Add rider'}
        </Title>

        <div className="grid gap-4 @md:grid-cols-2">
          <Input
            label="Name"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            label="Phone"
            placeholder="08030000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            type="email"
            label="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Select
            label="Vehicle"
            options={VEHICLE_OPTIONS}
            value={vehicleType}
            onChange={(value: VehicleType) => setVehicleType(value)}
            getOptionValue={(o) => (o as { value: VehicleType }).value}
            displayValue={(value) =>
              VEHICLE_OPTIONS.find((o) => o.value === value)?.label ?? 'Bike'
            }
          />
          <Input
            label="Plate number (optional)"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
          />
          <Input
            label="Licence number (optional)"
            value={licenseNumber}
            onChange={(e) => setLicenseNumber(e.target.value)}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(value: DriverStatus) => setStatus(value)}
            getOptionValue={(o) => (o as { value: DriverStatus }).value}
            displayValue={(value) =>
              STATUS_OPTIONS.find((o) => o.value === value)?.label ??
              'Available'
            }
            disabled={isOnTrip}
            helperText={
              isOnTrip
                ? 'On an active trip — finish the trip to change this'
                : undefined
            }
          />
        </div>

        <Textarea
          label="Notes (optional)"
          className="mt-4"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit || submitting}
            isLoading={submitting}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                phone: phone.trim(),
                email: email.trim() || undefined,
                vehicle: {
                  type: vehicleType,
                  plateNumber: plateNumber.trim() || undefined,
                },
                licenseNumber: licenseNumber.trim() || undefined,
                // Omitted while on a trip so a stale form value cannot desync
                // the rider from the run they are actually on.
                ...(isOnTrip ? {} : { status }),
                notes: notes.trim() || undefined,
              })
            }
          >
            {driver ? 'Save changes' : 'Add rider'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
