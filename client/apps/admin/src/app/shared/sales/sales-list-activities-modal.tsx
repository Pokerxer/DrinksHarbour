'use client';

import { useState, useEffect } from 'react';
import { PiX, PiSpinner } from 'react-icons/pi';
import { salesOrderService } from '@/services/salesOrder.service';
import { fmtDate } from './sales-list-helpers';

interface Props {
  orderId: string;
  token: string;
  open: boolean;
  onClose: () => void;
}

export default function ActivitiesModal({ orderId, token, open, onClose }: Props) {
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !orderId || !token) return;
    setLoading(true);
    setError('');
    salesOrderService.getActivities(orderId, token)
      .then((res) => setActivities(res.data ?? []))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [orderId, token, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Activities</h3>
          <button type="button" onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <PiX className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8"><PiSpinner className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : activities.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No activities found</p>
          ) : (
            <div className="space-y-3">
              {activities.map((a: any, i: number) => (
                <div key={a._id ?? i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-gray-500">{a.type}</span>
                    <span className="text-xs text-gray-400">{fmtDate(a.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-800">{a.subject}</p>
                  {a.description && <p className="mt-0.5 text-xs text-gray-500">{a.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
