'use client';
import React, { useEffect, useRef } from 'react';
import { Button } from 'rizzui/button';
import type { ErmPlan } from '@/services/erm.service';

export default function PlanConfirmation({
  plan,
  hasSubscription,
  busy,
  blocked,
  error,
  onConfirm,
  onClose,
}: {
  plan?: ErmPlan;
  hasSubscription: boolean;
  busy: boolean;
  blocked: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (plan && !dialog.current?.open) dialog.current?.showModal();
    if (!plan) dialog.current?.close();
  }, [plan]);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="plan-confirmation-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-muted bg-white p-6 text-gray-900 shadow-xl backdrop:bg-black/40 dark:bg-gray-50"
    >
      {plan && (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Subscription update
          </p>
          <h2
            id="plan-confirmation-title"
            className="mt-2 text-xl font-semibold"
          >
            {hasSubscription ? 'Confirm plan change' : 'Continue to checkout'}
          </h2>
          <div className="my-5 rounded-xl bg-gray-50 p-4">
            <p className="font-semibold">{plan.label}</p>
            <p className="mt-1 text-2xl font-semibold">
              ₦{plan.priceMonthly.toLocaleString('en-NG')}
              <span className="text-sm font-normal text-gray-500">
                {' '}
                / month
              </span>
            </p>
          </div>
          <p className="text-sm leading-6 text-gray-500">
            {hasSubscription
              ? 'Your current access stays in place until the scheduled change takes effect. There are no partial charges or credits.'
              : 'You will be redirected to Paystack to complete your subscription securely.'}
          </p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-red-200 p-3 text-sm text-red-600"
            >
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Go back
            </Button>
            <Button
              disabled={blocked || busy}
              isLoading={busy}
              onClick={onConfirm}
            >
              Confirm {hasSubscription ? 'change' : 'and continue'}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
