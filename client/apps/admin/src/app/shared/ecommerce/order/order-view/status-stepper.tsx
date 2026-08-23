'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  PiCheckBold,
  PiXCircleBold,
  PiArrowRightBold,
} from 'react-icons/pi';
import { Button } from 'rizzui';
import cn from '@core/utils/class-names';
import { orderService, type Order } from '@/services/order.service';
import { shortDate, humanize } from './format';
import {
  STATUS_STEPS,
  TERMINAL_STATES,
  NEXT_STATUS,
  NEXT_LABEL,
  getStatusIndex,
} from './status-config';
import ConfirmModal from './confirm-modal';
import { useOrderSession } from './permissions';

export default function StatusStepper({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate: (o: Order) => void;
}) {
  const { token, canManage } = useOrderSession();
  const [modal, setModal] = useState<'advance' | 'cancel' | null>(null);
  const [busy, setBusy] = useState(false);

  const terminal = TERMINAL_STATES[order.status];
  const currentIdx = getStatusIndex(order.status);
  const nextStatus = NEXT_STATUS[order.status];
  const canCancel = !terminal && order.status !== 'delivered';

  async function doUpdate(status: string, reason?: string) {
    if (!token) return toast.error('Session expired — sign in again');
    setBusy(true);
    try {
      const updated = await orderService.updateStatus(
        token,
        order._id,
        status,
        reason
      );
      onUpdate(updated);
      toast.success(`Order marked as ${humanize(status).toLowerCase()}`);
      setModal(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {terminal ? (
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <terminal.Icon className={cn('h-7 w-7', terminal.tone)} />
          </div>
          <p className={cn('text-sm font-semibold', terminal.tone)}>
            {terminal.label}
          </p>
          {terminal.tsKey && shortDate(order[terminal.tsKey]) && (
            <p className="mt-0.5 text-xs text-gray-400">
              {shortDate(order[terminal.tsKey])}
            </p>
          )}
          {order.cancelReason && order.status === 'cancelled' && (
            <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {order.cancelReason}
            </p>
          )}
          {/* Keep the trail visible so it's clear how far the order got */}
          <div className="mt-4 w-full border-t border-muted pt-3 text-start">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              History
            </p>
            <ul className="space-y-1">
              {STATUS_STEPS.map((s) => {
                const ts = shortDate(order[s.tsKey]);
                if (!ts) return null;
                return (
                  <li key={s.key} className="flex justify-between text-xs">
                    <span className="text-gray-500">{s.label}</span>
                    <span className="text-gray-700">{ts}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        <div>
          {order.status === 'partially_shipped' && (
            <p className="mb-4 rounded-lg bg-purple-500/10 px-3 py-2 text-xs font-medium text-purple-600 dark:text-purple-400">
              Partially shipped — some items are still with a vendor.
            </p>
          )}
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < currentIdx;
            const isActive = idx === currentIdx;
            const isFuture = idx > currentIdx;
            const ts = shortDate(order[step.tsKey]);

            return (
              <div
                key={step.key}
                className="relative flex gap-3 pb-5 last:pb-0"
              >
                {idx < STATUS_STEPS.length - 1 && (
                  <div
                    className={cn(
                      'absolute left-[17px] top-9 h-[calc(100%-20px)] w-0.5',
                      isCompleted ? 'bg-primary' : 'bg-gray-100'
                    )}
                  />
                )}

                <div
                  className={cn(
                    'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                    isCompleted &&
                      'border-primary bg-primary text-primary-foreground',
                    isActive &&
                      'border-primary bg-gray-0 text-primary shadow-md shadow-primary/20',
                    isFuture && 'border-muted bg-gray-50 text-gray-300'
                  )}
                >
                  {isCompleted ? (
                    <PiCheckBold className="h-4 w-4" />
                  ) : (
                    <step.Icon className="h-4 w-4" />
                  )}
                </div>

                <div className="flex-1 pt-1">
                  <p
                    className={cn(
                      'text-sm font-semibold leading-tight',
                      isCompleted || isActive
                        ? 'text-gray-900'
                        : 'text-gray-400'
                    )}
                  >
                    {step.label}
                    {isActive && (
                      <span className="ms-2 inline-block rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                        Current
                      </span>
                    )}
                  </p>
                  {ts ? (
                    <p className="mt-0.5 text-[11px] text-gray-400">{ts}</p>
                  ) : (
                    <p
                      className={cn(
                        'mt-0.5 text-[11px]',
                        isFuture ? 'text-gray-300' : 'text-gray-400'
                      )}
                    >
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage && (nextStatus || canCancel) && (
        <div className="mt-5 space-y-2 border-t border-muted pt-4 print:hidden">
          {nextStatus && (
            <Button
              className="w-full gap-2"
              onClick={() => setModal('advance')}
              disabled={busy}
            >
              <PiArrowRightBold className="h-4 w-4" />
              {NEXT_LABEL[order.status]}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              className="w-full gap-2 border-red-200 text-red-500 hover:bg-red-50"
              onClick={() => setModal('cancel')}
              disabled={busy}
            >
              <PiXCircleBold className="h-4 w-4" />
              Cancel Order
            </Button>
          )}
        </div>
      )}

      {modal === 'advance' && nextStatus && (
        <ConfirmModal
          title={NEXT_LABEL[order.status] ?? 'Update Status'}
          message={`Move this order from "${humanize(order.status)}" to "${humanize(nextStatus)}"?`}
          confirmLabel="Yes, update"
          loading={busy}
          onConfirm={() => doUpdate(nextStatus)}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'cancel' && (
        <ConfirmModal
          title="Cancel Order"
          message="This will cancel the order and return the reserved stock. This action cannot be undone."
          confirmLabel="Cancel Order"
          danger
          withReason
          reasonPlaceholder="Reason for cancellation (optional)"
          loading={busy}
          onConfirm={(reason) => doUpdate('cancelled', reason)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
