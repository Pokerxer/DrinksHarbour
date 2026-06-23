'use client';

import { useEffect, useState } from 'react';
import { Title, Text, Button, Loader } from 'rizzui';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { POSSession, POSClosingControl as POSClosingControlType } from '@/app/shared/point-of-sale/types';
import { formatCurrency, formatDate } from '@/app/shared/point-of-sale/utils';
import cn from '@core/utils/class-names';

type ClosingControlProps = {
  session: POSSession;
  onClose: (countedBalances: { method: string; counted: number }[], closingNotes: string) => void;
  onCancel: () => void;
};

export default function POSClosingControl({ session, onClose, onCancel }: ClosingControlProps) {
  const { token } = usePOSAuth();
  const [control, setControl] = useState<POSClosingControlType | null>(null);
  const [loading, setLoading] = useState(true);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [closingNotes, setClosingNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    posApi
      .getClosingControl(token, session._id)
      .then((data) => {
        setControl(data);
        const init: Record<string, string> = {};
        data.methods?.forEach((m: any) => {
          init[m.method] = String(m.theoretical);
        });
        setCounted(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, session._id]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader variant="spinner" />
      </div>
    );
  }

  if (!control) {
    return <div className="text-center text-gray-500">Failed to load closing data</div>;
  }

  function handleSubmit() {
    const balances = Object.entries(counted).map(([method, val]) => ({
      method,
      counted: Number(val) || 0,
    }));
    onClose(balances, closingNotes);
  }

  const allCounted = Object.values(counted).every((v) => v !== '' && Number(v) >= 0);
  const hasDifferences = control.methods.some((m) => {
    const countedVal = Number(counted[m.method] || 0);
    return Math.abs(countedVal - m.theoretical) > 0.01;
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Title as="h3" className="font-semibold">Closing Control</Title>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      <div className="rounded-xl border border-gray-200 p-5">
        <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Opened</span>
            <p className="font-medium">{formatDate(control.openedAt)}</p>
          </div>
          <div>
            <span className="text-gray-500">Opening Cash</span>
            <p className="font-medium">{formatCurrency(control.openingCash)}</p>
          </div>
          <div>
            <span className="text-gray-500">Total Sales</span>
            <p className="font-medium">{formatCurrency(control.totalSales)}</p>
          </div>
          <div>
            <span className="text-gray-500">Order Count</span>
            <p className="font-medium">{control.orderCount}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <Title as="h5">Payment Method Balances</Title>
        {control.methods.map((method) => {
          const countedVal = Number(counted[method.method] || 0);
          const diff = countedVal - method.theoretical;
          const hasDiff = Math.abs(diff) > 0.01;

          return (
            <div
              key={method.method}
              className={cn(
                'rounded-xl border p-4',
                hasDiff ? 'border-red-200 bg-red-50' : 'border-gray-200'
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <Text className="text-sm font-medium capitalize">
                  {method.method.replace('_', ' ')}
                </Text>
                {hasDiff && (
                  <span className="text-xs font-medium text-red-600">
                    Diff: {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-gray-400">Opening</span>
                  <p className="font-medium">{formatCurrency(method.opening)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Theoretical</span>
                  <p className="font-medium">{formatCurrency(method.theoretical)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Counted</span>
                  <input
                    type="number"
                    value={counted[method.method] ?? ''}
                    onChange={(e) =>
                      setCounted((prev) => ({ ...prev, [method.method]: e.target.value }))
                    }
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium outline-none focus:border-gray-900"
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>
              {method.orderCount > 0 && (
                <div className="mt-2 text-xs text-gray-400">
                  {method.orderCount} orders • {formatCurrency(method.orderTotal)} total
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">Closing Notes</label>
        <textarea
          value={closingNotes}
          onChange={(e) => setClosingNotes(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
          placeholder="Any notes about this session..."
        />
      </div>

      {hasDifferences && (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Some payment methods have differences between theoretical and counted amounts.
          Please verify before closing.
        </div>
      )}

      <Button
        className="h-12 w-full text-base"
        onClick={handleSubmit}
        isLoading={submitting}
        disabled={!allCounted}
      >
        Close Session
      </Button>
    </div>
  );
}
