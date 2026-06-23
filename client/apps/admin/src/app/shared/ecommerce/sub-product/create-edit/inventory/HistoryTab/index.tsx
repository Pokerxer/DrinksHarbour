// @ts-nocheck
'use client';

import { InventorySummaryCard } from './InventorySummaryCard';
import { ServerMovementsList } from './ServerMovementsList';
import type { InventoryMovement, InventorySummary } from '@/services/inventory.service';

interface HistoryTabProps {
  subProductId: string | undefined;
  inventorySummary: InventorySummary | null;
  serverMovements: InventoryMovement[];
  isLoadingMovements: boolean;
  onRecordStock: () => void;
  onRefreshMovements?: () => void;
  onCancelMovement?: (id: string) => void;
}

export function HistoryTab({
  subProductId,
  inventorySummary,
  serverMovements,
  isLoadingMovements,
  onRecordStock,
  onRefreshMovements,
  onCancelMovement,
}: HistoryTabProps) {
  return (
    <div className="space-y-5">
      <InventorySummaryCard
        subProductId={subProductId}
        inventorySummary={inventorySummary}
        isLoading={isLoadingMovements}
        onRecordStock={onRecordStock}
      />

      <ServerMovementsList
        movements={serverMovements}
        isLoading={isLoadingMovements}
        onRefresh={onRefreshMovements || (() => {})}
        onCancel={onCancelMovement || (() => {})}
      />
    </div>
  );
}

// Re-export for other consumers
export { InventorySummaryCard } from './InventorySummaryCard';
export { ServerMovementsList } from './ServerMovementsList';
