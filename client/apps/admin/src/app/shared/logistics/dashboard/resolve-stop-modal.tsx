'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Modal, Text, Textarea, Title } from 'rizzui';
import { naira, oneLineAddress } from '../format';
import type { DeliveryStop, ResolveStopPayload } from '../types';

interface ResolveStopModalProps {
  open: boolean;
  stop: DeliveryStop | null;
  mode: 'delivered' | 'failed';
  onClose: () => void;
  onSubmit: (payload: ResolveStopPayload) => void;
  submitting?: boolean;
}

/**
 * Proof of delivery on success; a reason on failure. Cash is pre-filled with
 * the full amount owed, so the common case (rider collected exactly the right
 * money) is one click and a short payment has to be typed deliberately.
 */
export default function ResolveStopModal({
  open,
  stop,
  mode,
  onClose,
  onSubmit,
  submitting,
}: ResolveStopModalProps) {
  const [recipientName, setRecipientName] = useState('');
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [codCollected, setCodCollected] = useState('');

  const owed = stop?.codExpected ?? 0;

  useEffect(() => {
    if (!open) return;
    setRecipientName(stop?.addressSnapshot?.fullName ?? '');
    setNote('');
    setPhotoUrl('');
    setFailureReason('');
    setCodCollected(owed > 0 ? String(owed) : '');
  }, [open, stop, owed]);

  if (!stop) return null;

  const isDelivered = mode === 'delivered';
  const canSubmit = isDelivered ? true : failureReason.trim().length > 0;

  function handleSubmit() {
    if (isDelivered) {
      onSubmit({
        status: 'delivered',
        proofOfDelivery: {
          recipientName: recipientName.trim() || undefined,
          note: note.trim() || undefined,
          photoUrl: photoUrl.trim() || undefined,
        },
        ...(owed > 0 ? { codCollected: Number(codCollected) || 0 } : {}),
      });
    } else {
      onSubmit({ status: 'failed', failureReason: failureReason.trim() });
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} size="md">
      <div className="p-6">
        <Title as="h3" className="mb-1 text-lg font-semibold">
          {isDelivered ? 'Confirm delivery' : 'Mark stop failed'}
        </Title>
        <Text className="mb-5 text-sm text-gray-500">
          {stop.addressSnapshot?.fullName || 'Customer'} —{' '}
          {oneLineAddress(stop.addressSnapshot)}
        </Text>

        {isDelivered ? (
          <div className="space-y-4">
            <Input
              label="Received by"
              placeholder="Who took the delivery?"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />

            {owed > 0 ? (
              <Input
                type="number"
                label={`Cash collected (owed ${naira(owed)})`}
                value={codCollected}
                onChange={(e) => setCodCollected(e.target.value)}
                helperText={
                  Number(codCollected) < owed
                    ? `Short by ${naira(owed - Number(codCollected || 0))}`
                    : undefined
                }
                error={
                  Number(codCollected) > owed
                    ? 'More than the amount owed'
                    : undefined
                }
              />
            ) : null}

            <Input
              label="Photo URL (optional)"
              placeholder="https://…"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />

            <Textarea
              label="Note (optional)"
              placeholder="Anything worth recording"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        ) : (
          <Textarea
            label="What went wrong?"
            placeholder="Customer unreachable, wrong address, refused delivery…"
            value={failureReason}
            onChange={(e) => setFailureReason(e.target.value)}
          />
        )}

        {!isDelivered ? (
          <Text className="mt-3 text-xs text-gray-500">
            The order stays marked as shipped — the goods are still out with the
            rider.
          </Text>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color={isDelivered ? 'primary' : 'danger'}
            disabled={!canSubmit || submitting}
            isLoading={submitting}
            onClick={handleSubmit}
          >
            {isDelivered ? 'Confirm delivered' : 'Mark failed'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
