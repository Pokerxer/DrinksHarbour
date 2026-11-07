'use client';
import { useRef, useState } from 'react';
import {
  type Enrollment,
  type MarketScope,
} from '@/services/market-foundation.service';
import {
  ScopeFields,
  fieldClass,
  buttonClass,
  helperClass,
  useUnsavedGuard,
} from '../market-foundation/workspace';
type Save = (path: string, body: unknown) => Promise<void>;
export function ApplicationForm({
  rows,
  busy,
  save,
}: {
  rows: Enrollment[];
  busy: boolean;
  save: Save;
}) {
  const [scope, setScope] = useState<MarketScope>({
    market: 'NG',
    category: 'beverage',
    channel: 'marketplace',
  });
  const [statement, setStatement] = useState('');
  const initial = useRef(scope);
  const unsaved =
    JSON.stringify(scope) !== JSON.stringify(initial.current) ||
    statement.trim() !== '';
  useUnsavedGuard(unsaved);
  const prior = rows.find(
    (row) =>
      row.market === scope.market &&
      row.category === scope.category &&
      row.channel === scope.channel
  );
  const protectedApproval =
    prior?.status === 'approved' &&
    !!prior.effectiveUntil &&
    new Date(prior.effectiveUntil).getTime() > Date.now();
  return (
    <form
      className="space-y-4 rounded-xl border border-muted p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (protectedApproval) return;
        void save('/market-enrollments/apply', {
          ...scope,
          statement,
          expectedVersion: prior?.version || 0,
        });
      }}
    >
      <h2 className="text-lg font-semibold">Apply for selling enrollment</h2>
      <p className="max-w-2xl text-sm leading-6 text-gray-600">
        These applications do not change your ERM subscription or grant approval
        automatically.
      </p>
      <ScopeFields value={scope} onChange={setScope} />
      <label className="block">
        Application statement
        <textarea
          className={fieldClass}
          required
          minLength={5}
          maxLength={1000}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
        />
      </label>
      <p className={helperClass}>
        Describe your stock, premises and fulfilment readiness for the chosen
        scope (5–1000 characters).
      </p>
      {protectedApproval && (
        <p role="status">
          Renewals or changes to this approval require platform review. Your
          existing approval will be preserved.
        </p>
      )}
      {unsaved && !protectedApproval && !busy && (
        <p
          role="status"
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          Unsaved draft — submit or reload before navigating away.
        </p>
      )}
      <button className={buttonClass} disabled={busy || protectedApproval}>
        Apply for enrollment
      </button>
    </form>
  );
}
export function ReviewForm({
  row,
  busy,
  save,
}: {
  row: Enrollment;
  busy: boolean;
  save: Save;
}) {
  const [status, setStatus] = useState<'approved' | 'rejected' | 'suspended'>(
      'rejected'
    ),
    [reason, setReason] = useState(''),
    [from, setFrom] = useState(''),
    [until, setUntil] = useState('');
  return (
    <form
      className="space-y-4 rounded-xl border border-muted p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save(`/market-enrollments/${row._id}/review`, {
          status,
          reason,
          expectedVersion: row.version,
          ...(status === 'approved'
            ? {
                effectiveFrom: new Date(from).toISOString(),
                effectiveUntil: new Date(until).toISOString(),
              }
            : {}),
        });
      }}
    >
      <h2 className="font-semibold">
        Review {row.market} {row.category} / {row.channel}
      </h2>
      <p className="max-w-2xl text-sm leading-6 text-gray-600">
        Merchant: {row.tenant}. Application version {row.version}.{' '}
        {row.statement}
      </p>
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Decision
        </legend>
        <label className="block">
          Decision
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="rejected">Reject</option>
            <option value="approved">Approve for a defined term</option>
            <option value="suspended">Suspend</option>
          </select>
        </label>
        {status === 'approved' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              Starts (your local time)
              <input
                className={fieldClass}
                type="datetime-local"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </label>
            <label>
              Ends (your local time)
              <input
                className={fieldClass}
                type="datetime-local"
                required
                min={from}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </label>
          </div>
        )}
      </fieldset>
      <label className="block">
        Review reason
        <textarea
          className={fieldClass}
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <span className={helperClass}>
          Recorded against the application and shown to the merchant.
        </span>
      </label>
      <p className="max-w-2xl text-sm leading-6 text-gray-600">
        Latest revision takes effect immediately. Future terms deny new sales
        until their start. ERM access remains separate.
      </p>
      <button className={buttonClass} disabled={busy}>
        Record enrollment decision
      </button>
    </form>
  );
}
