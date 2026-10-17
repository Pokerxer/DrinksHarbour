export interface ShoppingLocation {
  lat: number; lon: number; label: string; source: 'delivery' | 'current';
  addressId?: string; ownerId?: string;
}
export interface LocationState {
  accountId: string | null; explicit: ShoppingLocation | null;
  defaultDelivery: ShoppingLocation | null; current: ShoppingLocation | null;
}
export function validShoppingLocation(value: unknown): value is ShoppingLocation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<ShoppingLocation>;
  return typeof v.lat === 'number' && Number.isFinite(v.lat) && Math.abs(v.lat) <= 90 &&
    typeof v.lon === 'number' && Number.isFinite(v.lon) && Math.abs(v.lon) <= 180 &&
    typeof v.label === 'string' && (v.source === 'delivery' || v.source === 'current');
}
export function resolveShoppingLocation(state: LocationState): ShoppingLocation | null {
  const permitted = (v: ShoppingLocation | null) => validShoppingLocation(v) && (!v.ownerId || v.ownerId === state.accountId);
  if (permitted(state.explicit)) return state.explicit;
  if (permitted(state.defaultDelivery)) return state.defaultDelivery;
  return permitted(state.current) ? state.current : null;
}
export function changeShoppingAccount(state: LocationState, accountId: string | null): LocationState {
  const keep = (v: ShoppingLocation | null) => v?.ownerId && v.ownerId !== accountId ? null : v;
  return { accountId, explicit: keep(state.explicit), defaultDelivery: keep(state.defaultDelivery), current: keep(state.current) };
}
export function readShoppingSession(raw: string | null): ShoppingLocation | null {
  try { const value: unknown = JSON.parse(raw || 'null'); return validShoppingLocation(value) ? value : null; }
  catch { return null; }
}
