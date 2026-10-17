import type { SalesOrder } from '@/services/salesOrder.service';
import { outstanding } from './sales-helpers';

export type OperationsKind = 'fulfill' | 'returns';
export type OperationsFilters = {
  search: string;
  status: string;
  warehouse: string;
};
export const emptyOperationsFilters: OperationsFilters = {
  search: '',
  status: '',
  warehouse: '',
};
export function operationsQuantity(order: SalesOrder, kind: OperationsKind) {
  return (
    Math.round(
      (order.items || []).reduce((sum, item) => {
        if (item.lineType && item.lineType !== 'product') return sum;
        const quantity =
          kind === 'fulfill'
            ? outstanding(item)
            : Math.max(0, item.returnedQty || 0);
        return sum + (Number.isFinite(quantity) ? quantity : 0);
      }, 0) * 1000
    ) / 1000
  );
}
export function operationsWarehouse(order: SalesOrder) {
  const warehouse = order.warehouseId;
  return {
    id:
      typeof warehouse === 'string'
        ? warehouse
        : warehouse?._id || 'unassigned',
    name:
      typeof warehouse === 'object' && warehouse?.name
        ? warehouse.name
        : warehouse
          ? 'Unnamed warehouse'
          : 'Unassigned',
  };
}
export function operationsOrders(
  orders: SalesOrder[],
  kind: OperationsKind,
  filters: OperationsFilters
) {
  const search = filters.search.trim().toLowerCase();
  return orders.filter(
    (order) =>
      operationsQuantity(order, kind) > 0 &&
      (!filters.status || order.orderStatus === filters.status) &&
      (!filters.warehouse ||
        operationsWarehouse(order).id === filters.warehouse) &&
      (!search ||
        [
          order.soNumber,
          order.customerSnapshot?.name,
          operationsWarehouse(order).name,
        ].some((value) => value?.toLowerCase().includes(search)))
  );
}
