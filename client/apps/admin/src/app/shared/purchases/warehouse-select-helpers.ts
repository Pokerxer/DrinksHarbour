// app/shared/purchases/warehouse-select-helpers.ts — pure seeding rules for the
// destination-warehouse picker, shared by create / edit / receipt / settings.
import type { Warehouse } from '@/services/warehouse.service';

/**
 * Decide which warehouse a picker should show once the list has loaded.
 *
 * Order: the user's own current pick → the configured setting (tenant default
 * receiving warehouse, or the PO's stored destination) → the warehouse flagged
 * `isDefault` → the first one in the list.
 *
 * Every candidate is checked against the loaded list, so a stale id (a deleted or
 * deactivated warehouse) falls through instead of leaving the select on a phantom
 * value that the server would then reject.
 *
 * @returns a warehouse id, or '' when there are no warehouses at all
 */
export function pickSeedWarehouse(
  warehouses: Warehouse[],
  { current, setting }: { current?: string; setting?: string }
): string {
  const exists = (id?: string) =>
    !!id && warehouses.some((w) => w._id === id) ? id : undefined;

  return (
    exists(current) ??
    exists(setting) ??
    warehouses.find((w) => w.isDefault)?._id ??
    warehouses[0]?._id ??
    ''
  );
}
