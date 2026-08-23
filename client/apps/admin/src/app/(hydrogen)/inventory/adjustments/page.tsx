import { metaObject } from '@/config/site.config';
import InventoryMovementsBrowser from '@/app/shared/inventory/inventory-movements-browser';

export const metadata = {
  ...metaObject(
    'Inventory - Adjustments',
    undefined,
    'Browse, filter and audit stock adjustments — increases, decreases, reasons and cost impact.'
  ),
};

export default function InventoryAdjustmentsPage() {
  return <InventoryMovementsBrowser preset="adjustments" />;
}
