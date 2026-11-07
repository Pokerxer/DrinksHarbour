'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuthorization } from '@/hooks/use-authorization';
import {
  countryRequest,
  type CountryConfiguration,
} from '@/services/country.service';
import CountryEditor, { actionClass, fieldClass } from './country-editor';
import CountryReadiness from './country-readiness';
export default function CountriesView() {
  const { user, role } = useAuthorization();
  if (role !== 'super_admin')
    return (
      <p role="alert">Super-admin access is required to manage countries.</p>
    );
  return <CountryWorkspace key={user?.token} token={user?.token || ''} />;
}
function CountryWorkspace({ token }: { token: string }) {
  const [countries, setCountries] = useState<CountryConfiguration[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    if (!token) {
      setLoading(false);
      return () => controller.abort();
    }
    void countryRequest<CountryConfiguration[]>(
      token,
      '',
      'GET',
      undefined,
      controller.signal
    )
      .then((data) => {
        if (!controller.signal.aborted) setCountries(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : 'Unable to load countries');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, reload]);
  const current = countries.find((c) => c.code === selected);
  const mutate = async (
    path: string,
    method: string,
    body: Record<string, unknown>
  ) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await countryRequest(token, path, method, {
        ...body,
        expectedVersion: current?.version,
        reason,
      });
      setCountries((rows) =>
        [...rows.filter((c) => c.code !== result.code), result].sort((a, b) =>
          a.code.localeCompare(b.code)
        )
      );
      setSelected(result.code);
      setReason('');
      setNotice('Country change saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save country');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <main className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-muted bg-gray-50 p-5 dark:bg-gray-100/30">
        <div>
          <h1 className="text-2xl font-semibold">Countries</h1>
          <p className="mt-1 text-sm text-gray-600">
            Configure markets, review launch prerequisites and control
            availability.
          </p>
        </div>
        <button
          type="button"
          className={actionClass}
          disabled={busy || loading}
          onClick={() => setReload((n) => n + 1)}
        >
          Reload countries
        </button>
      </header>
      {error && (
        <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
          <p
            role="alert"
            className="text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </p>
          <button
            type="button"
            className={actionClass}
            onClick={() => setReload((n) => n + 1)}
          >
            Retry country read
          </button>
        </div>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-300"
        >
          {notice}
        </p>
      )}
      {loading ? (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading countries…</span>
          {[0, 1].map((skeleton) => (
            <span
              className="block h-14 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800/70"
              key={skeleton}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav aria-label="Country configurations" className="space-y-2">
            <button
              className={`${actionClass} w-full text-left`}
              disabled={busy}
              onClick={() => {
                setSelected(null);
                setNotice('');
              }}
            >
              Add country
            </button>
            {countries.map((country) => (
              <button
                key={country.code}
                type="button"
                aria-pressed={selected === country.code}
                disabled={busy}
                onClick={() => {
                  setSelected(country.code);
                  setNotice('');
                }}
                className="block min-h-11 w-full rounded-lg border border-muted p-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-primary aria-pressed:bg-gray-50 motion-reduce:transition-none"
              >
                <span className="font-medium">
                  {country.name} ({country.code})
                </span>
                <span className="mt-1 block text-xs text-gray-600">
                  {country.version === 0
                    ? 'Legacy default · not reviewed'
                    : `${country.active ? 'Active' : 'Inactive'} · version ${country.version}`}
                </span>
              </button>
            ))}
          </nav>
          <div className="min-w-0 space-y-6 rounded-xl border border-muted p-4 sm:p-6">
            <h2 className="text-lg font-semibold">
              {current ? current.name : 'New country'}
            </h2>
            {current?.version === 0 && (
              <p className="text-sm text-gray-600">
                This legacy default is not an approved launch configuration.
                Create a saved inactive configuration to begin review.
              </p>
            )}
            <label className="block text-sm font-medium">
              Reason for change
              <input
                aria-label="Reason for change"
                className={fieldClass}
                value={reason}
                disabled={busy}
                minLength={5}
                maxLength={1000}
                onChange={(event) => setReason(event.target.value)}
              />
              <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                {reason.trim().length >= 5
                  ? 'Recorded with every save, review and activation.'
                  : 'At least 5 characters — required before any save or activation.'}
              </span>
            </label>
            <CountryEditor
              key={`${selected}:${current?.version}`}
              country={current}
              busy={busy}
              canSave={reason.trim().length >= 5}
              save={(data) =>
                void mutate(
                  current && current.version > 0 ? `/${current.code}` : '',
                  current && current.version > 0 ? 'PUT' : 'POST',
                  data
                )
              }
            />
            {current && current.version > 0 && (
              <CountryReadiness
                key={`review:${current.code}:${current.version}`}
                country={current}
                busy={busy}
                canSave={reason.trim().length >= 5}
                review={(prerequisite, evidence) =>
                  void mutate(`/${current.code}/review`, 'POST', {
                    prerequisite,
                    evidence,
                  })
                }
                activate={(active) =>
                  void mutate(`/${current.code}/activation`, 'POST', { active })
                }
              />
            )}
            {!!current?.revisions?.length && (
              <section className="border-t border-gray-200 pt-5">
                <h2 className="text-lg font-semibold">Change history</h2>
                <ol className="mt-3 space-y-3">
                  {[...current.revisions].reverse().map((item) => (
                    <li
                      key={item.version}
                      className="border-l-2 border-gray-200 pl-3 text-sm"
                    >
                      <p className="font-medium">
                        Version {item.version} · {item.action} ·{' '}
                        {new Date(item.at).toLocaleString()}
                      </p>
                      <p className="break-words text-gray-600">{item.reason}</p>
                      <p className="text-xs text-gray-500">
                        Reviewer: {item.actor}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
