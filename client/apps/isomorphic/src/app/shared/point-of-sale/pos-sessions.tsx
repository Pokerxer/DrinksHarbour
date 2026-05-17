'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Title, Text, Button, Loader, Empty } from 'rizzui';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { POSSession } from '@/app/shared/point-of-sale/types';
import { formatCurrency, formatDate } from '@/app/shared/point-of-sale/utils';
import POSClosingControl from '@/app/shared/point-of-sale/components/pos-closing-control';
import cn from '@core/utils/class-names';
import toast from 'react-hot-toast';
import { routes } from '@/config/routes';
import { PiArrowLeft } from 'react-icons/pi';

export default function POSSessions() {
  const { token } = usePOSAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<POSSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<POSSession | null>(null);
  const [showClosing, setShowClosing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    posApi
      .getSessions(token, page, 20)
      .then((data) => {
        setSessions(data.sessions || []);
        setTotal(data.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, page]);

  async function handleCloseSession(countedBalances: { method: string; counted: number }[], closingNotes: string) {
    if (!token || !selectedSession) return;
    try {
      await posApi.closeSession(token, selectedSession._id, countedBalances, closingNotes);
      toast.success('Session closed successfully');
      setShowClosing(false);
      setSelectedSession(null);
      const data = await posApi.getSessions(token, 1, 20);
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  if (showClosing && selectedSession) {
    return (
      <POSClosingControl
        session={selectedSession}
        onClose={(balances, notes) => handleCloseSession(balances, notes)}
        onCancel={() => { setShowClosing(false); setSelectedSession(null); }}
      />
    );
  }

  return (
    <div className="flex h-dvh flex-col bg-gray-50">
      {/* Header bar */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={() => router.push(routes.pos.sell)}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          <PiArrowLeft className="h-4 w-4" />
          Back
        </button>
        <Title as="h5" className="font-semibold text-gray-900">Sessions</Title>
      </div>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader variant="spinner" />
        </div>
      ) : sessions.length === 0 ? (
        <Empty text="No sessions found" className="h-64 justify-center" />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session._id}
              className={cn(
                'rounded-xl border p-5 transition-all',
                session.status === 'open'
                  ? 'border-green-200 bg-green-50'
                  : 'border-gray-200'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      session.status === 'open' ? 'bg-green-500' : 'bg-gray-400'
                    )}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Text className="text-sm font-medium">
                        Opened {formatDate(session.openedAt)}
                      </Text>
                      {session.openedBy && (
                        <Text className="text-xs text-gray-400">
                          by {session.openedBy.posName || `${session.openedBy.firstName} ${session.openedBy.lastName}`}
                        </Text>
                      )}
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-gray-500">
                      <span>Orders: {session.orderCount}</span>
                      <span>Sales: {formatCurrency(session.totalSales)}</span>
                      <span>Cash: {formatCurrency(session.cashSales)}</span>
                      <span>Card: {formatCurrency(session.cardSales)}</span>
                      {session.closedAt && <span>Closed: {formatDate(session.closedAt)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Text className={cn(
                    'text-sm font-semibold',
                    session.status === 'open' ? 'text-green-600' : 'text-gray-600'
                  )}>
                    {session.status === 'open' ? 'Open' : 'Closed'}
                  </Text>
                  {session.status === 'open' && (
                    <Button
                      size="sm"
                      onClick={() => { setSelectedSession(session); setShowClosing(true); }}
                    >
                      Close
                    </Button>
                  )}
                </div>
              </div>

              {session.hasDifference && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  Cash difference detected at closing
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="flex items-center text-sm text-gray-500">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
      </div>
    </div>
  );
}
