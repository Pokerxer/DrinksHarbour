'use client';
import { useEffect, useState } from 'react';
import { posApi } from '../api';
import type { POSShop } from '../types';

export function ShopHistorySelector({ token, value, onChange }: {
  token: string | null; value: string; onChange: (shopId: string) => void;
}) {
  const [shops, setShops] = useState<POSShop[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (token) posApi.listShops(token).then(data => { if (!cancelled) setShops(data.shops); }).catch(() => {});
    return () => { cancelled = true; };
  }, [token]);
  return <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
    Shop
    <select aria-label="Shop history" value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2">
      <option value="retail">Retail</option>
      {shops.map(shop => <option key={shop._id} value={shop._id}>{shop.name}{shop.active === false ? ' (inactive)' : ''}</option>)}
      {!['retail', 'legacy', 'all'].includes(value) && !shops.some(s => s._id === value) && <option value={value}>Selected shop</option>}
      <option value="all">All shops (back office)</option>
      <option value="legacy">Legacy — unassigned</option>
    </select>
  </label>;
}
