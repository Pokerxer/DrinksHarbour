'use client';
import { useState } from 'react';
import useCycleSetup from './use-cycle-setup';
import SetupEmployee from './setup-employee';
export default function CycleSetup(props: Parameters<typeof useCycleSetup>[0]) {
  const {
    selected,
    update,
    options,
    eligibleIds,
    hasUnavailable,
    valid,
    busy,
    message,
    error,
    confirmReload,
    setConfirmReload,
    save,
    reloadSaved,
  } = useCycleSetup(props);
  const [search, setSearch] = useState('');
  return (
    <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-lg font-semibold">
        Participants and bonus allocations
      </h2>
      <p className="text-sm text-gray-500">
        Select who receives an appraisal, then choose who can appraise.
        Appraisers rate every other selected employee. Roster, appraisers and
        allocations are fixed after launch.
      </p>
      <label className="block text-sm">
        Find an employee
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-1 w-full rounded-lg border p-2"
        />
      </label>
      <p className="text-sm">
        {Object.keys(selected).length} selected ·{' '}
        {Object.values(selected).filter((p) => p.isAppraiser).length} appraisers
      </p>
      <div className="max-h-96 space-y-3 overflow-auto">
        {options
          .filter((p) =>
            p.displayName.toLowerCase().includes(search.toLowerCase())
          )
          .map((p) => (
            <SetupEmployee
              key={p.employee}
              employee={p}
              eligible={eligibleIds.has(p.employee)}
              choice={selected[p.employee]}
              busy={busy}
              onChange={(choice) => {
                const next = { ...selected };
                if (choice) next[p.employee] = choice;
                else delete next[p.employee];
                update(next);
              }}
            />
          ))}
      </div>
      {hasUnavailable && (
        <p role="alert" className="text-sm text-amber-700">
          Remove unavailable employees before saving this roster.
        </p>
      )}
      {!valid && (
        <p className="text-sm text-gray-500">
          Select at least two appraisers so everyone receives a rating, and
          enter nonnegative allocations with at most two decimal places.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {error && !confirmReload && (
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmReload(true)}
          className="text-sm underline"
        >
          Reload saved roster
        </button>
      )}
      {confirmReload && (
        <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm">
          <p>
            Discard your unsaved edits and load the latest saved roster,
            appraisers and bonus allocations?
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={reloadSaved}
            className="mr-3 underline"
          >
            Discard edits and reload
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmReload(false)}
            className="underline"
          >
            Keep my edits
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !valid}
        onClick={save}
        className="rounded-lg bg-[#b20202] px-4 py-2 text-white disabled:opacity-50"
      >
        Save roster
      </button>
    </section>
  );
}
