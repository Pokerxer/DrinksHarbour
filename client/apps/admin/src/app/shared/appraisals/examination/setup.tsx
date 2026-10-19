'use client';
import { useState } from 'react';
import useExamSetup from './use-exam-setup';
import SetupSettings from './setup-settings';
import SetupOverview from './setup-overview';
import QuestionSources from './question-sources';
import QuestionBankEditor from './question-bank-editor';
import type { PeerEmployee } from '@/services/peerAppraisal.service';
import type { QuestionBankOption } from '@/services/examination.service';
export default function ExaminationSetup(
  props: Parameters<typeof useExamSetup>[0] & {
    disabled?: boolean;
    banks?: QuestionBankOption[];
    recipients?: PeerEmployee[];
    rosterDirty?: boolean;
  }
) {
  const state = useExamSetup(props);
  const [sourceBusy, setSourceBusy] = useState(false);
  const { config, update, enabled, busy } = state;
  return (
    <section
      className="space-y-5 rounded-2xl border border-gray-200 bg-white p-4 sm:p-6"
      aria-label="Examination setup"
    >
      <h2 className="text-lg font-semibold">
        Examination and performance score
      </h2>
      {state.changed && (
        <p className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
          Unsaved changes
        </p>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="rounded border-gray-300 text-[#b20202] accent-[#b20202] focus:ring-[#b20202]"
          checked={enabled}
          disabled={busy || sourceBusy || props.disabled}
          onChange={(e) => state.toggle(e.target.checked)}
        />
        Include examination and attendance
      </label>
      <p className="text-sm leading-6 text-gray-500">
        Selected employees use examination, appraisal and attendance equally.
        Employees without an examination use appraisal and attendance equally.
        The combined percentage determines each bonus.
      </p>
      {enabled && (
        <fieldset
          disabled={busy || props.disabled}
          className="min-w-0 space-y-4"
        >
          <div className="grid min-w-0 items-start gap-4 @3xl:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_300px]">
            <SetupSettings
              config={config}
              onChange={update}
              departments={state.departments}
              reloadDepartments={state.reloadDepartments}
              recipients={props.recipients}
              rosterDirty={props.rosterDirty}
              selectedIds={state.recipientIds}
            />
            <SetupOverview config={config} issues={state.issues} />
          </div>
          <QuestionSources
            cycleId={props.cycleId}
            banks={props.banks}
            disabled={busy || Boolean(props.disabled)}
            onUse={state.replaceBank}
            onBusy={setSourceBusy}
          />
          <QuestionBankEditor
            config={config}
            disabled={busy || Boolean(props.disabled)}
            onChange={update}
          />
        </fieldset>
      )}
      {state.error && (
        <div role="alert" className="space-y-2 text-sm text-red-700">
          <p>{state.error} Your edits remain on this screen.</p>
          <button
            type="button"
            disabled={busy || sourceBusy || props.disabled}
            onClick={state.discardAndReload}
            className="underline"
          >
            Discard examination edits and reload saved settings
          </button>
        </div>
      )}
      {state.message && (
        <p role="status" className="text-sm text-green-700">
          {state.message}
        </p>
      )}
      {(enabled || props.initial || state.changed) && (
        <button
          type="button"
          disabled={busy || sourceBusy || props.disabled || !state.valid}
          onClick={state.save}
          className="rounded-xl bg-[#b20202] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#960202] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202] disabled:opacity-40"
        >
          Save examination settings
        </button>
      )}
    </section>
  );
}
