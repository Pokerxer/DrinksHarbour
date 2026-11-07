'use client';

/**
 * Per-row controls for the pending queue: approve + reject.
 *
 * Approve copy is driven by the shared `getApproveCopy` primitive — only
 * tenant-private rows get the "Approve & publish to marketplace" promotion
 * wording (with its explanation as the button tooltip); legacy pending rows
 * keep the plain "Approve" label. Both actions disable independently while
 * their request is in flight.
 */

import { Button } from 'rizzui';
import { getApproveCopy } from '../product-list/components';
import type { PendingProductDTO } from '@/services/product.service';

export default function PendingQueueActions({
  product,
  approveBusy = false,
  rejectBusy = false,
  onApprove,
  onReject,
}: {
  product: PendingProductDTO;
  approveBusy?: boolean;
  rejectBusy?: boolean;
  onApprove: (product: PendingProductDTO) => void;
  onReject: (product: PendingProductDTO) => void;
}) {
  // Legacy rows (no publicationScope) keep the plain action label; only
  // tenant-private rows need the promotion wording.
  const { label: approveLabel, explanation } =
    product.publicationScope === 'tenant_private'
      ? getApproveCopy(product.publicationScope)
      : { label: 'Approve', explanation: null };

  return (
    <div className="flex items-center justify-end gap-2 pe-2">
      <Button
        size="sm"
        isLoading={approveBusy}
        onClick={() => onApprove(product)}
        title={explanation ?? undefined}
      >
        {approveBusy ? 'Approving…' : approveLabel}
      </Button>
      {/* Destructive separation: Reject stays visually subordinate to the
          primary Approve and carries the semantic danger outline — the
          highlighted primary action never shares a control cluster styling
          with the destructive one. Confirmation lives in the reason modal. */}
      <Button
        size="sm"
        variant="outline"
        color="danger"
        onClick={() => onReject(product)}
        disabled={rejectBusy}
        title="Reject with a required reason"
      >
        {rejectBusy ? 'Rejecting…' : 'Reject'}
      </Button>
    </div>
  );
}
