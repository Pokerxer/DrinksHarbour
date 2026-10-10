import type { HistoryKind } from '@/services/warehouseHistory.service';
export const historyStatuses: Record<HistoryKind, string[]> = {
  purchases: ['draft', 'confirmed', 'partially_received', 'received', 'validated', 'cancelled'],
  transfers: [
    'draft',
    'pending_approval',
    'confirmed',
    'in_transit',
    'partially_received',
    'completed',
    'cancelled',
    'rejected',
  ],
  movements: [
    'received',
    'adjusted',
    'shipped',
    'transfer_in',
    'transfer_out',
    'returned',
    'return_out',
  ],
  transfer_movements: ['transfer_in', 'transfer_out', 'returned', 'return_out'],
};
