'use client';
import { useRef, useState } from 'react';
import {
  resetEmployeeExamination,
  type ExaminationAttemptProgress,
} from '@/services/examination.service';
export default function ResetAttempt({
  cycleId,
  employee,
  displayName,
  cycleRevision,
  attempt,
  onReset,
  disabled = false,
}: {
  cycleId: string;
  employee: string;
  displayName: string;
  cycleRevision: number;
  attempt: ExaminationAttemptProgress;
  onReset: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const lock = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  async function reset() {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await resetEmployeeExamination(
        cycleId,
        employee,
        attempt.revision,
        cycleRevision
      );
      setConfirm(false);
      setSuccess(true);
      await onReset();
      trigger.current?.focus();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not reset the test. Refresh progress and try again.'
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <div
      className="min-w-[180px] max-w-[280px] space-y-2 text-left"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && !busy) {
          setConfirm(false);
          trigger.current?.focus();
        }
      }}
    >
      <span className="block text-xs text-gray-600">
        {attempt.submittedAt
          ? attempt.timedOut
            ? 'Time expired'
            : 'Test submitted'
          : attempt.startedAt
            ? 'Test in progress'
            : 'Test not started'}
      </span>
      <button
        ref={trigger}
        type="button"
        aria-label={`Reset test for ${displayName}`}
        disabled={disabled || busy || success}
        aria-expanded={confirm}
        onClick={() => {
          setConfirm(true);
          setError('');
        }}
        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50"
      >
        Reset test
      </button>
      {confirm && (
        <div
          role="group"
          aria-label={`Confirm test reset for ${displayName}`}
          className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-3"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && !busy) {
              setConfirm(false);
              trigger.current?.focus();
            }
          }}
        >
          <p className="whitespace-normal text-xs leading-5 text-red-900">
            Clear {displayName}’s saved answers, score and timer?{' '}
            {attempt.durationMinutes
              ? `The full ${attempt.durationMinutes} minutes will start when they begin again.`
              : 'They can begin the test again.'}{' '}
            The assigned questions stay the same.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => void reset()}
              className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Resetting…' : 'Clear answers and reset time'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setConfirm(false);
                trigger.current?.focus();
              }}
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
            >
              Keep current attempt
            </button>
          </div>
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="whitespace-normal text-xs leading-5 text-red-700"
        >
          {error}
        </p>
      )}
      {success && (
        <p
          role="status"
          className="whitespace-normal text-xs leading-5 text-green-700"
        >
          Test reset. Refresh the employee’s page to start again.
        </p>
      )}
    </div>
  );
}
