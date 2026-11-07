'use client';
import { useRef, useState } from 'react';
import {
  type CategoryPolicy,
  type MarketScope,
} from '@/services/market-foundation.service';
import {
  ScopeFields,
  fieldClass,
  fieldErrorClass,
  buttonClass,
  helperClass,
  useFoundationWorkspace,
  useUnsavedGuard,
  WorkspaceStatus,
} from '../market-foundation/workspace';
export default function PolicyEditor({ token }: { token: string }) {
  const state = useFoundationWorkspace<CategoryPolicy[]>(
    token,
    '/market-policies'
  );
  const [scope, setScope] = useState<MarketScope>({
      market: 'NG',
      category: 'beverage',
      channel: 'marketplace',
    }),
    [mode, setMode] = useState<'open' | 'closed' | 'exclusive'>('closed');
  const [exclusive, setExclusive] = useState(''),
    [exclusiveError, setExclusiveError] = useState(''),
    [exceptions, setExceptions] = useState(''),
    [from, setFrom] = useState(''),
    [until, setUntil] = useState(''),
    [reference, setReference] = useState(''),
    [reason, setReason] = useState(''),
    [datesError, setDatesError] = useState('');
  const prior = state.data?.find(
    (row) =>
      row.market === scope.market &&
      row.category === scope.category &&
      row.channel === scope.channel
  );
  const initial = useRef({
    scope,
    mode,
    exclusive,
    exceptions,
    from,
    until,
    reference,
    reason,
  });
  const unsaved = (() => {
    const base = initial.current;
    return (
      JSON.stringify(scope) !== JSON.stringify(base.scope) ||
      mode !== base.mode ||
      exclusive !== base.exclusive ||
      exceptions !== base.exceptions ||
      from !== base.from ||
      until !== base.until ||
      reference !== base.reference ||
      reason !== base.reason
    );
  })();
  useUnsavedGuard(unsaved);
  function validateWindow(): string {
    if (from && until && new Date(from) >= new Date(until))
      return 'Policy start must be before its end.';
    return '';
  }
  return (
    <section className="mt-6 space-y-3">
      <h2 className="text-xl font-semibold">Market category policies</h2>
      <WorkspaceStatus error={state.error} notice={state.notice} />
      <button type="button" className={buttonClass} onClick={state.reload}>
        Reload policies
      </button>
      {state.data && (
        <>
          <ul className="space-y-2">
            {state.data.map((row) => (
              <li
                key={row._id}
                className="rounded-lg border border-muted p-3 text-sm"
              >
                {row.market} / {row.category} / {row.channel}: {row.mode},
                version {row.version}; {row.effectiveFrom} to{' '}
                {row.effectiveUntil}; {row.contractReference}
                {row.mode === 'exclusive' && (
                  <div className="mt-1 text-sm">
                    <p>
                      Exclusive merchant:{' '}
                      {row.exclusiveTenant || 'Missing reviewed identifier'}
                    </p>
                    <p>
                      Exception merchants:{' '}
                      {row.exceptions.length
                        ? row.exceptions.join(', ')
                        : 'None'}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <form
            className="space-y-5 rounded-xl border border-muted p-4 sm:p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const windowError = validateWindow();
              if (windowError) {
                setDatesError(windowError);
                return;
              }
              void state.save('/market-policies', {
                ...scope,
                mode,
                expectedVersion: prior?.version || 0,
                effectiveFrom: new Date(from).toISOString(),
                effectiveUntil: new Date(until).toISOString(),
                contractReference: reference,
                reason,
                ...(mode === 'exclusive'
                  ? {
                      exclusiveTenant: exclusive,
                      exceptions: exceptions.split(/[\s,]+/).filter(Boolean),
                    }
                  : {}),
              });
            }}
          >
            <ScopeFields value={scope} onChange={setScope} />
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Policy terms
              </legend>
              <label className="block">
                Policy
                <select
                  className={fieldClass}
                  value={mode}
                  onChange={(e) => setMode(e.target.value as typeof mode)}
                >
                  <option value="closed">Closed</option>
                  <option value="open">
                    Open to approved enrolled merchants
                  </option>
                  <option value="exclusive">
                    Exclusive merchant with named exceptions
                  </option>
                </select>
              </label>
              {mode === 'exclusive' && (
                <>
                  <label className="block">
                    Exclusive merchant identifier
                    <input
                      className={fieldClass}
                      required
                      pattern="[a-fA-F0-9]{24}"
                      value={exclusive}
                      onChange={(e) => {
                        setExclusive(e.target.value);
                        setExclusiveError('');
                      }}
                      onBlur={(e) =>
                        setExclusiveError(
                          /^[a-fA-F0-9]{24}$/.test(e.target.value.trim())
                            ? ''
                            : 'Enter the 24-character reviewed merchant identifier.'
                        )
                      }
                      aria-invalid={exclusiveError ? true : undefined}
                    />
                    <span
                      aria-live="polite"
                      className={
                        exclusiveError ? fieldErrorClass : helperClass
                      }
                    >
                      {exclusiveError ||
                        'Merchant identifier from the reviewed agreement (24 characters).'}
                    </span>
                  </label>
                  <label className="block">
                    Exception merchant identifiers (comma separated)
                    <textarea
                      className={fieldClass}
                      value={exceptions}
                      onChange={(e) => setExceptions(e.target.value)}
                    />
                    <span className={helperClass}>
                      Leave empty when no other merchants may sell in this
                      scope.
                    </span>
                  </label>
                </>
              )}
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Active window
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  Policy starts (your local time)
                  <input
                    className={fieldClass}
                    type="datetime-local"
                    required
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setDatesError('');
                    }}
                  />
                </label>
                <label>
                  Policy ends (your local time)
                  <input
                    className={fieldClass}
                    type="datetime-local"
                    required
                    min={from}
                    value={until}
                    onChange={(e) => {
                      setUntil(e.target.value);
                      setDatesError('');
                    }}
                    onBlur={() => setDatesError(validateWindow())}
                    aria-invalid={datesError ? true : undefined}
                  />
                  {datesError && (
                    <span
                      role="alert"
                      aria-live="polite"
                      className={fieldErrorClass}
                    >
                      {datesError}
                    </span>
                  )}
                </label>
              </div>
            </fieldset>
            <label className="block">
              Reviewed contract reference
              <input
                className={fieldClass}
                required
                minLength={5}
                maxLength={1000}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
              <span className={helperClass}>
                Quote the reviewed agreement document this policy follows.
              </span>
            </label>
            <label className="block">
              Policy reason
              <textarea
                className={fieldClass}
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <p className="max-w-2xl text-sm leading-6 text-gray-600">
              A future revision replaces the current version immediately and
              denies sales until its start. This records a reviewed agreement;
              it does not establish one.
            </p>
            {unsaved && (
              <p
                role="status"
                className="text-xs text-gray-500 dark:text-gray-400"
              >
                Unsaved policy draft — submit or reload before navigating away.
              </p>
            )}
            <button
              className={buttonClass}
              disabled={state.busy || !!datesError}
            >
              Save policy
            </button>
          </form>
        </>
      )}
    </section>
  );
}
