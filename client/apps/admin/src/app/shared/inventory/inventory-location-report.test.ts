import { expect, it } from 'vitest';
import type { Warehouse } from '@/services/warehouse.service';
import type { StockRow } from '@/services/warehouseStock.service';
import { locationReports, filterLocations } from './inventory-location-report';
const warehouses = [
  { _id: 'w', name: 'Wyn City', code: 'WYN', type: 'warehouse', isActive: true, isDefault: true },
  { _id: 's', name: 'Abuja Shop', code: 'SHOP', type: 'store', isActive: false },
] as Warehouse[];
const stock = [
  {
    warehouseId: 'w',
    subProductId: 'p',
    productName: 'Léon Wine',
    sku: 'LEON',
    currentQuantity: 5,
    reservedQuantity: 2,
    costPrice: 100,
  },
  {
    warehouseId: 'w',
    subProductId: 'p',
    productName: 'Léon Wine',
    currentQuantity: -1,
    reservedQuantity: 0,
    costPrice: 100,
  },
  { warehouseId: 's', subProductId: 'q', productName: 'Ceres Juice', currentQuantity: 0 },
  { warehouseId: '', subProductId: 'u', currentQuantity: 99 },
] as StockRow[];
it('counts products once across sizes, retains signed units and separates unassigned stock', () => {
  const reports = locationReports(warehouses, stock);
  expect(reports[0].totals).toMatchObject({
    products: 1,
    lines: 2,
    units: 4,
    reserved: 2,
    available: 2,
    value: 400,
  });
  expect(reports[1].totals.units).toBe(0);
  expect(locationReports(warehouses, [{ ...stock[0], currentQuantity: NaN }])[0].totals.units).toBe(
    0,
  );
});
it('matches multiple accent-insensitive product or location searches and intersects filters', () => {
  const reports = locationReports(warehouses, stock);
  expect(
    filterLocations(reports, {
      search: 'leon, ceres',
      type: '',
      status: '',
      stock: '',
      sort: 'name',
    }),
  ).toHaveLength(2);
  expect(
    filterLocations(reports, {
      search: 'leon, ceres',
      type: 'warehouse',
      status: 'active',
      stock: 'stocked',
      sort: 'name',
    }).map((r) => r.warehouse._id),
  ).toEqual(['w']);
  expect(
    filterLocations(reports, {
      search: '',
      type: '',
      status: '',
      stock: 'empty',
      sort: 'name',
    }).map((r) => r.warehouse._id),
  ).toEqual(['s']);
});
