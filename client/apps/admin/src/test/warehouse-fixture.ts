import type { Warehouse } from '@/services/warehouse.service';
export const warehouseFixture = (overrides: Partial<Warehouse> = {}): Warehouse => ({ _id: 'warehouse', tenant: 'tenant', name: 'Warehouse', code: 'W', type: 'warehouse', isActive: true, isDefault: false, createdAt: '2026-10-19T00:00:00Z', updatedAt: '2026-10-19T00:00:00Z', ...overrides });
