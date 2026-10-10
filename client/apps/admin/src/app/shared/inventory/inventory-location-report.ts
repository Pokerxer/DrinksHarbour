import type { Warehouse } from '@/services/warehouse.service';
import type { StockRow } from '@/services/warehouseStock.service';
import { finite } from './inventory-dashboard-analysis';
import { lineValue } from './inventory-stock-search';
export const LOCATION_TYPES = {
  warehouse: 'Warehouse',
  store: 'Store',
  distribution_center: 'Distribution center',
};
export interface LocationFilters {
  search: string;
  type: string;
  status: string;
  stock: string;
  sort: string;
}
export const EMPTY_LOCATION_FILTERS: LocationFilters = {
  search: '',
  type: '',
  status: '',
  stock: '',
  sort: 'name',
};
export function locationAddress(w: Warehouse) {
  return (
    [
      w.address?.line1,
      w.address?.line2,
      w.address?.city,
      w.address?.state,
      w.address?.country,
      w.address?.postalCode,
    ]
      .filter(Boolean)
      .join(', ') || 'Address not recorded'
  );
}
export function locationReports(warehouses: Warehouse[], stock: StockRow[]) {
  const grouped = new Map<string, StockRow[]>();
  for (const row of stock) {
    const rows = grouped.get(row.warehouseId) || [];
    rows.push(row);
    grouped.set(row.warehouseId, rows);
  }
  return warehouses.map((warehouse) => {
    const rows = grouped.get(warehouse._id) || [];
    const units = rows.reduce((sum, row) => sum + finite(row.currentQuantity), 0);
    const reserved = rows.reduce((sum, row) => sum + finite(row.reservedQuantity), 0);
    return {
      warehouse,
      rows,
      totals: {
        lines: rows.length,
        products: new Set(rows.map((row) => row.subProductId).filter(Boolean)).size,
        units,
        reserved,
        available: units - reserved,
        value: rows.reduce((sum, row) => sum + lineValue(row), 0),
        alerts: rows.filter(
          (row) =>
            row.flags?.lowStock ||
            row.flags?.outOfStock ||
            row.flags?.nearExpiry ||
            row.flags?.belowReorder ||
            finite(row.currentQuantity) <= 0,
        ).length,
      },
    };
  });
}
export type LocationReport = ReturnType<typeof locationReports>[number];
const normal = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export function filterLocations(reports: LocationReport[], filters: LocationFilters) {
  const alternatives = normal(filters.search)
    .split(/[,;\n]+/)
    .map((text) => text.trim())
    .filter(Boolean);
  return reports
    .filter(({ warehouse: w, rows, totals }) => {
      if (filters.type && w.type !== filters.type) return false;
      if (filters.status && w.isActive !== (filters.status === 'active')) return false;
      if (filters.stock === 'stocked' && !rows.some((row) => finite(row.currentQuantity) > 0))
        return false;
      if (filters.stock === 'empty' && rows.some((row) => finite(row.currentQuantity) > 0))
        return false;
      if (filters.stock === 'alerts' && !totals.alerts) return false;
      const fields = [
        normal(
          [w.name, w.code, locationAddress(w), w.contact?.name, w.contact?.email, w.contact?.phone]
            .filter(Boolean)
            .join(' '),
        ),
        ...rows.map((row) =>
          normal([row.productName, row.sku, row.sizeName].filter(Boolean).join(' ')),
        ),
      ];
      return (
        !alternatives.length ||
        alternatives.some((query) =>
          fields.some((field) => query.split(/\s+/).every((term) => field.includes(term))),
        )
      );
    })
    .sort((a, b) => {
      if (filters.sort === 'units')
        return b.totals.units - a.totals.units || a.warehouse.name.localeCompare(b.warehouse.name);
      if (filters.sort === 'value')
        return b.totals.value - a.totals.value || a.warehouse.name.localeCompare(b.warehouse.name);
      return a.warehouse.name.localeCompare(b.warehouse.name);
    });
}
