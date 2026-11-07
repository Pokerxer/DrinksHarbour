'use client';
import { useState } from 'react';
import { GraduationCap, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  buttonClass,
  dangerButtonClass,
  panelClass,
  primaryButtonClass,
} from './controls';

const steps = [
  'Review a request without promising a table',
  'Seat an arrival at an available table',
  'Keep an unknown payment pending',
  'Reconcile a verified payment before closing',
];
const trapActions = [
  'Promise future capacity',
  'Use an occupied table',
  'Take another payment',
  'Close with funds unverified',
];
const correctActions = [
  'Record the request as reviewed',
  'Claim an available table',
  'Keep pending and reconcile',
  'Use verified settlement, then close',
];

export default function Practice({ scope }: { scope: string }) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState('');
  return (
    <section className={`${panelClass} space-y-4`} aria-label="Staff practice">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold">Staff practice</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-300 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
          <GraduationCap aria-hidden="true" className="size-3.5" />
          Step {Math.min(step + 1, steps.length)} of {steps.length}
        </span>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Isolated practice: no bookings, stock, payments or messages are changed.
      </p>
      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${Math.min(step, steps.length) * 25}%` }}
        />
      </div>
      {step < steps.length ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{steps[step]}</h3>
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={dangerButtonClass}
              onClick={() =>
                setMessage(
                  'Keep the request or payment unresolved until the required evidence is available.',
                )
              }
            >
              <ShieldAlert aria-hidden="true" className="size-4" />
              {trapActions[step]}
            </button>
            <button
              className={primaryButtonClass}
              onClick={() => {
                setMessage('');
                setStep(step + 1);
                if (step === steps.length - 1)
                  localStorage.setItem(
                    `venue-practice:${scope}`,
                    new Date().toISOString(),
                  );
              }}
            >
              <ShieldCheck aria-hidden="true" className="size-4" />
              {correctActions[step]}
            </button>
          </div>
          {message && (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
            >
              <strong>Not the correct step.</strong> {message}
            </p>
          )}
        </div>
      ) : (
        <p
          role="status"
          className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm font-medium text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200"
        >
          Practice completed on this device. A manager still needs to review
          operational readiness.
        </p>
      )}
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-gray-700 underline transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:text-gray-200 dark:hover:text-white"
        onClick={() => {
          setStep(0);
          setMessage('');
        }}
      >
        Restart practice
      </button>
    </section>
  );
}
