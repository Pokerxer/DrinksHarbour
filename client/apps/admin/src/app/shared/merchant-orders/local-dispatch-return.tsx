'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  dispatchRequest,
  type DispatchBooking,
  type ReturnDisposition,
} from '@/services/local-dispatch.service';
import { buttonClass, fieldClass } from '../market-foundation/workspace';
import { PiLockSimpleBold, PiWarningBold } from 'react-icons/pi';
import {
  fieldLabel,
  gateAlert,
  gateAwaiting,
  gateBlocked,
  inlineIcon,
  ledgerHeader,
  ledgerPanel,
  ledgerProse,
  ledgerProseSoft,
  ledgerTitle,
  sourceTrace,
} from './design-tokens';
import {
  awaitingTreatment,
  CONDITIONS,
  CONDITION_LABELS,
  EVIDENCE_KINDS,
  eligibleTreatments,
  rangeLabel,
  TREATMENT_LABELS,
  uninspected,
} from './local-dispatch-return.helpers';
export default function DispatchReturn({
  booking,
  token,
  busy,
  perform,
}: {
  booking: DispatchBooking;
  token: string;
  busy: boolean;
  perform: (path: string, payload: Record<string, unknown>) => Promise<void>;
}) {
  const [detail, setDetail] = useState<ReturnDisposition | null>(null),
    [error, setError] = useState(''),
    [conditions, setConditions] = useState<Record<string, string>>({}),
    [evidence, setEvidence] = useState<Record<string, string>>({}),
    [evidenceKind, setEvidenceKind] = useState<Record<string, string>>({}),
    [treatments, setTreatments] = useState<Record<string, string>>({});
  const load = useCallback(
    async (signal: AbortSignal) => {
      try {
        const data = await dispatchRequest<{ return: ReturnDisposition }>(
          token,
          `/bookings/${booking._id}/return`,
          'GET',
          undefined,
          signal
        );
        if (!signal.aborted) {
          setDetail(data.return);
          setError('');
        }
      } catch (issue) {
        if (!signal.aborted)
          setError(
            issue instanceof Error
              ? issue.message
              : 'Return disposition is unavailable.'
          );
      }
    },
    [token, booking._id]
  );
  useEffect(() => {
    if (booking.state !== 'returned') return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, booking.version, booking.state]);
  if (booking.state !== 'returned') return null;
  if (error)
    return (
      <p role="alert" className={gateAlert}>
        <PiWarningBold aria-hidden="true" className={inlineIcon} />
        {error}
      </p>
    );
  if (!detail) return null;
  const recordInspection = () =>
    void perform(`/bookings/${booking._id}/return/inspect`, {
      expectedVersion: detail.version,
      lines: detail.lines
        .map((line) => ({
          line: line.line,
          condition: conditions[line.line],
          ranges: uninspected(detail, line.line),
          ...(evidence[line.line]?.trim()
            ? {
                evidence: [
                  {
                    kind: evidenceKind[line.line] || 'operator_note',
                    reference: evidence[line.line].trim(),
                  },
                ],
              }
            : {}),
        }))
        .filter((line) => line.condition && line.ranges.length),
    });
  const confirmDecision = () =>
    void perform(`/bookings/${booking._id}/return/decision`, {
      expectedVersion: detail.version,
      lines: detail.lines
        .map((line) => ({
          line: line.line,
          treatment: treatments[line.line],
          ranges: awaitingTreatment(detail, line.line),
        }))
        .filter((line) => line.treatment && line.ranges.length),
    });
  return (
    <div className={ledgerPanel}>
      <div className={ledgerHeader}>
        <p className={ledgerTitle}>Quarantined return disposition</p>
      </div>
      <div className="space-y-4 px-4 py-3 sm:px-5">
        {/* Unit ledger: exact returned ranges, mono trace for the ranges */}
        <ul aria-label="Recorded returned units">
          {detail.lines.map((line, index) => (
            <li
              key={line.line}
              className={`${index > 0 ? 'border-t border-gray-100 dark:border-gray-800/70' : ''} py-2`}
            >
              <p className={ledgerProse}>
                {line.line} · {line.quantity} returned · unit ranges:{' '}
                <span className={sourceTrace}>{rangeLabel(line.ranges)}</span>
              </p>
            </li>
          ))}
        </ul>
        {detail.inspections.length > 0 && (
          <ul className="space-y-1">
            {detail.inspections.map((item) => (
              <li key={`${item.line}-${item.condition}`} className="border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                <p className={ledgerProseSoft}>
                  inspected {item.condition} · {item.line} ·{' '}
                  {rangeLabel(item.ranges)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {detail.decisions.length > 0 && (
          <ul className="space-y-1">
            {detail.decisions.map((item) => (
              <li key={`${item.line}-${item.treatment}`} className="border-l-2 border-gray-300 pl-3 dark:border-gray-600">
                <p className={ledgerProseSoft}>
                  {item.treatment} · {item.line} · {rangeLabel(item.ranges)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {/* Gate 1 — inspection evidence per unit range (deliberate, awaiting) */}
        {detail.lines.some((line) => uninspected(detail, line.line).length > 0) && (
          <div className={`${gateAwaiting} space-y-3`}>
            <p className={ledgerProse}>
              Record the inspected condition for every returned unit range before
              deciding treatment.
            </p>
            {detail.lines
              .filter((line) => uninspected(detail, line.line).length > 0)
              .map((line) => (
                <div key={line.line} className="space-y-2">
                  <label className="block">
                    <span className={fieldLabel}>Condition for {line.line}</span>
                    <select
                      className={fieldClass}
                      value={conditions[line.line] || ''}
                      onChange={(e) =>
                        setConditions({
                          ...conditions,
                          [line.line]: e.target.value,
                        })
                      }
                    >
                      <option value="">Choose inspected condition</option>
                      {CONDITIONS.map((condition) => (
                        <option key={condition} value={condition}>
                          {CONDITION_LABELS[condition]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block">
                      <span className={fieldLabel}>Evidence kind for {line.line}</span>                      <select
                        className={fieldClass}
                        value={evidenceKind[line.line] || 'operator_note'}
                        onChange={(e) =>
                          setEvidenceKind({
                            ...evidenceKind,
                            [line.line]: e.target.value,
                          })
                        }
                      >
                        {EVIDENCE_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {kind}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className={fieldLabel}>Evidence reference for {line.line}</span>
                      <input
                        className={fieldClass}
                        value={evidence[line.line] || ''}
                        maxLength={120}
                        onChange={(e) =>
                          setEvidence({ ...evidence, [line.line]: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
              ))}
            <button
              className={buttonClass}
              disabled={
                busy ||
                !detail.lines.some(
                  (line) =>
                    conditions[line.line] && uninspected(detail, line.line).length
                )
              }
              onClick={recordInspection}
            >
              Record inspection
            </button>
          </div>
        )}
        {/* Gate 2 — eligible treatment decision (deliberate, awaiting) */}
        {detail.lines.some((line) => awaitingTreatment(detail, line.line).length > 0) && (
          <div className={`${gateAwaiting} space-y-3`}>
            {detail.lines
              .filter((line) => awaitingTreatment(detail, line.line).length > 0)
              .map((line) => (
                <label key={line.line} className="block">
                  <span className={fieldLabel}>Treatment for {line.line}</span>
                  <select
                    className={fieldClass}
                    value={treatments[line.line] || ''}
                    onChange={(e) =>
                      setTreatments({
                        ...treatments,
                        [line.line]: e.target.value,
                      })
                    }
                  >
                    <option value="">Choose eligible treatment</option>
                    {eligibleTreatments(detail, line.line).map((treatment) => (
                      <option key={treatment} value={treatment}>
                        {TREATMENT_LABELS[treatment]}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            <button
              className={buttonClass}
              disabled={
                busy ||
                !detail.lines.some(
                  (line) =>
                    treatments[line.line] &&
                    awaitingTreatment(detail, line.line).length > 0
                )
              }
              onClick={confirmDecision}
            >
              Confirm treatment decision
            </button>
          </div>
        )}
        {/* Fail-closed effects: designed-blocked register (not an error) */}
        <div className={gateBlocked}>
          <PiLockSimpleBold aria-hidden="true" className={inlineIcon} />
          <p className={ledgerProse}>
            Stock and cost effects unsupported: {detail.effects.reasons.join(' ')}
          </p>
        </div>
      </div>
    </div>
  );
}
