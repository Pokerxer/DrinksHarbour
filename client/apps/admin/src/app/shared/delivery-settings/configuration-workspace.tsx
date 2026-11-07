'use client';
import { useEffect, useRef, useState } from 'react';
import {
  deliverySettingsRequest,
  type ConfigurationLocation,
  type DeliveryConfiguration,
  type ReviewedContract,
  type ReviewInput,
} from '@/services/delivery-settings.service';
import ContractForm from './contract-form';
import ContractHistory from './contract-history';
import { buttonClass } from '../market-foundation/workspace';
export default function ConfigurationWorkspace({
  token,
  location,
}: {
  token: string;
  location: ConfigurationLocation;
}) {
  const [data, setData] = useState<DeliveryConfiguration>(),
    [page, setPage] = useState(1),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [revoke, setRevoke] = useState<ReviewedContract>();
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void deliverySettingsRequest<DeliveryConfiguration>(
      token,
      `/configuration/${location.tenant}/${location._id}?page=${page}&limit=10`,
      'GET',
      undefined,
      controller.signal
    )
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : 'Unable to load reviewed terms'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, location.tenant, location._id, page, revision]);
  async function save(
    path: string,
    input: ReviewInput | Record<string, never>
  ) {
    if (lock.current || loading) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deliverySettingsRequest(token, path, 'POST', input);
      if (!alive.current) return false;
      setNotice('Saved. Refreshing reviewed terms.');
      setRevoke(undefined);
      setRevision((v) => v + 1);
      return true;
    } catch (e) {
      if (alive.current)
        setError(
          `${e instanceof Error ? e.message : 'Unable to save'}. The result may be unknown. Refresh reviewed terms before retrying; keep the same submitted version.`
        );
      return false;
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{location.name}</h2>
        <button
          className={buttonClass}
          disabled={busy || loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          Refresh reviewed terms
        </button>
      </header>
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/20">
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
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
      {loading && (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading reviewed terms…</span>
          <span className="block h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/70" />
          <span className="block h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/70" />
        </div>
      )}
      {data && (
        <>
          <div className="rounded-lg border border-muted p-4">
            <h3 className="font-semibold">
              {data.state === 'unavailable'
                ? 'No reviewed delivery terms'
                : `Current review: ${data.state}`}
            </h3>
            <p className="max-w-2xl text-sm leading-6 text-gray-600">
              {data.creationEnabled
                ? 'New booking creation is enabled only when all reviewed terms are satisfied.'
                : 'New booking creation is disabled.'}{' '}
              Accepted bookings keep their original terms and remain recoverable
              after revocation or expiry.
            </p>
          </div>
          <ContractForm
            location={location}
            version={(data.latest?.version || 0) + 1}
            busy={busy || loading}
            onSave={(input) => save('/contracts', input)}
          />
          {revoke && (
            <section
              aria-label="Confirm revocation"
              className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20"
            >
              <h3 className="font-semibold">
                Revoke version {revoke.version} for {location.name}?
              </h3>
              <p className="max-w-2xl text-sm leading-6 text-gray-700 dark:text-gray-300">
                Evidence: {revoke.reviewReference}. This stops new use of these
                terms. Accepted bookings retain their original terms.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className={buttonClass}
                  disabled={busy || loading}
                  onClick={() =>
                    void save(
                      `/contracts/${encodeURIComponent(revoke._id)}/revoke`,
                      {}
                    )
                  }
                >
                  Confirm revocation
                </button>
                <button
                  className={buttonClass}
                  disabled={busy}
                  onClick={() => setRevoke(undefined)}
                >
                  Keep review
                </button>
              </div>
            </section>
          )}
          <ContractHistory
            data={data}
            page={page}
            busy={busy || loading}
            onPage={setPage}
            onRevoke={setRevoke}
          />
        </>
      )}
    </div>
  );
}
