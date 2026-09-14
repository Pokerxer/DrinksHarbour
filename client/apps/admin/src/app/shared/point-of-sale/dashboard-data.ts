import { posApi } from './api';
import type { POSDashboardData, POSSessionInfo, POSShop } from './types';

export interface DashboardResult {
  dashboard: POSDashboardData | null;
  shops: POSShop[];
  sessions: Record<string, POSSessionInfo>;
  errors: string[];
}

const message = (reason: unknown) => reason instanceof Error ? reason.message : 'Could not load data';

export async function loadDashboardData(token: string, shopId: string): Promise<DashboardResult> {
  const result: DashboardResult = { dashboard: null, shops: [], sessions: {}, errors: [] };
  const [overview, shops] = await Promise.allSettled([
    posApi.getDashboard(token, shopId),
    posApi.listShops(token),
  ]);
  if (overview.status === 'fulfilled') result.dashboard = overview.value;
  else result.errors.push(`Overview: ${message(overview.reason)}`);
  if (shops.status === 'fulfilled') result.shops = shops.value.shops;
  else result.errors.push(`Shops: ${message(shops.reason)}`);

  // Session requests depend on this response, never the previously persisted list.
  const terminals = [{ _id: 'retail', name: 'Retail', mode: 'retail' as const }, ...result.shops];
  const sessions = await Promise.allSettled(terminals.map(shop =>
    posApi.getSessionInfo(token, shop.mode, shop._id)));
  sessions.forEach((response, index) => {
    const shop = terminals[index];
    if (response.status === 'fulfilled') result.sessions[shop._id] = response.value;
    else result.errors.push(`${shop.name} session: ${message(response.reason)}`);
  });
  return result;
}
