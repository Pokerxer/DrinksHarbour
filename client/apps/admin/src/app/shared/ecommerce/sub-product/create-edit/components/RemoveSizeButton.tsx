'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from 'rizzui';
import { PiTrashSimple } from 'react-icons/pi';
import { z } from 'zod';
import FormDialog from './FormDialog';

type Status = { allowed: boolean; reason: string | null };
const eligibilityResponse = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.object({ allowed: z.boolean(), reason: z.string().nullable() }).optional(),
});
const deleteFailureResponse = z.object({
  message: z.string().optional(),
});

export default function RemoveSizeButton({
  productId, sizeId, label, onRemove,
}: {
  productId?: string;
  sizeId?: string;
  label: string;
  onRemove: () => void;
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  async function check() {
    setOpen(true);
    setStatus(null);
    if (!sizeId) {
      // Unsaved form row — nothing exists in the database yet, so confirming
      // only drops the row from the form.
      setStatus({ allowed: true, reason: null });
      return;
    }
    setBusy(true);
    try {
      if (!productId || !session?.user?.token) throw new Error('Please sign in again before removing this size.');
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${base}/api/subproducts/${encodeURIComponent(productId)}/sizes/${encodeURIComponent(sizeId)}/deletion`, {
        headers: { Authorization: `Bearer ${session.user.token}` },
        cache: 'no-store',
      });
      const result = eligibilityResponse.safeParse(await response.json());
      if (!result.success) throw new Error('Unable to check size history. Please retry.');
      const body = result.data;
      if (!response.ok || !body.success || !body.data) throw new Error(body.message || 'Unable to check size history. Please retry.');
      setStatus(body.data);
    } catch (error) {
      setStatus({ allowed: false, reason: error instanceof Error ? error.message : 'Unable to check size history. Please retry.' });
    } finally {
      setBusy(false);
    }
  }

  // Confirm is a database deletion, not a form edit: the saved Size document
  // and its WarehouseStock rows are deleted right now (server re-checks
  // stock/history before deleting), then the row leaves the form. An unsaved
  // row (no sizeId) has no document to delete — removing it is form-local.
  async function remove() {
    if (!sizeId) {
      setOpen(false);
      onRemove();
      return;
    }
    setBusy(true);
    try {
      if (!productId || !session?.user?.token) throw new Error('Please sign in again before removing this size.');
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
      const response = await fetch(`${base}/api/subproducts/${encodeURIComponent(productId)}/sizes/${encodeURIComponent(sizeId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.user.token}` },
        cache: 'no-store',
      });
      const result = deleteFailureResponse.safeParse(await response.json());
      if (!response.ok) {
        throw new Error(result.success ? (result.data.message || 'Unable to delete this size. Please retry.') : 'Unable to delete this size. Please retry.');
      }
      setOpen(false);
      onRemove();
    } catch (error) {
      // Keep the dialog open and surface why the size survived (stock or
      // recorded history appeared since the eligibility check).
      setStatus({ allowed: false, reason: error instanceof Error ? error.message : 'Unable to delete this size. Please retry.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" aria-label={`Remove size ${label}`} onClick={check} className="text-red-600 hover:bg-red-50">
        <PiTrashSimple className="h-4 w-4" />
      </Button>
      <FormDialog open={open} busy={busy} onClose={() => setOpen(false)} title={`Remove ${label}?`}
        footer={<>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Keep size</Button>
          <Button type="button" disabled={busy || !status?.allowed} onClick={remove}>Remove size</Button>
        </>}>
        <p className="text-sm text-gray-700" role="status">
          {busy ? 'Deleting…' : status?.allowed
            ? 'The size is deleted from the database immediately — no save needed. Sizes with stock or recorded history cannot be deleted.'
            : status?.reason}
        </p>
      </FormDialog>
    </>
  );
}
