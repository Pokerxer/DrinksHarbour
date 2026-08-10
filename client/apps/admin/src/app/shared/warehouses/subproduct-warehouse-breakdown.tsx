'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  warehouseStockService,
  type WarehouseStockRow,
} from '@/services/warehouseStock.service';
import { warehouseNameOf, sizeLabelOf } from './warehouse-ref-helpers';

export default function SubproductWarehouseBreakdown({
  subProductId,
}: {
  subProductId: string;
}) {
  const { data: session } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';
  const [rows, setRows] = useState<WarehouseStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !subProductId) return;
    setLoading(true);
    warehouseStockService
      .getStockByWarehouse(subProductId, token)
      .then((res) => setRows(res.data ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [token, subProductId]);

  const total = rows.reduce((s, r) => s + r.currentQuantity, 0);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium">Stock by warehouse</h3>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-400">Not stocked in any warehouse.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r._id} className="flex items-center justify-between py-2">
              <span>
                {warehouseNameOf(r) || 'Unknown warehouse'}{' '}
                <span className="text-gray-400">
                  · {sizeLabelOf(r) || 'Unknown size'}
                </span>
              </span>
              <span className="font-medium">{r.currentQuantity}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
