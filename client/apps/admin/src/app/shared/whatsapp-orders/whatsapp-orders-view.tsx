'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icon from 'react-icons/pi';
import { useAuthorization } from '@/hooks/use-authorization';
import { routes } from '@/config/routes';
import { whatsappOrderService } from '@/services/whatsapp-order.service';
import IntakeList, { type Row } from './intake-list';

export default function WhatsAppOrdersView() {
  const { user } = useAuthorization();
  const token = user?.token || '';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const body = await whatsappOrderService.listManualOrders(token) as { orders?: Row[] };
      setRows(body.orders || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load orders'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-gray-500">Orders transcribed from WhatsApp conversations. Tenants fulfill them like any marketplace order.</p>
        <Link href={routes.whatsappOrders.create}
          className="flex shrink-0 items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all">
          <Icon.PiPlusBold size={14} /> New WhatsApp Order
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      <IntakeList rows={rows} loading={loading} />
    </div>
  );
}
