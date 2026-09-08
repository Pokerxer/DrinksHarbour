'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from 'rizzui';
import { PiKeyDuotone, PiCopyBold, PiShieldCheckDuotone } from 'react-icons/pi';
import { useAuthorization } from '@/hooks/use-authorization';
import { useTenant } from '@/context/TenantContext';
import {
  apiKeyRequest,
  type ApiKey,
  type NewApiKey,
} from '@/services/api-key.service';
import SettingsPageHeader from '@/app/shared/settings/settings-page-header';
import CreateKeyForm from './create-key-form';
import KeyList from './key-list';

export default function ApiKeysView() {
  const { user, checkPermission, role } = useAuthorization();
  const { tenant } = useTenant();
  const token = user?.token || '';
  return (
    <KeyWorkspace
      key={`${token}:${tenant?._id}`}
      token={token}
      canManage={
        ['tenant_owner', 'tenant_admin'].includes(role) ||
        checkPermission('settings:write')
      }
      hasAccess={
        tenant
          ? tenant.capabilities?.includes('api_access') === true
          : undefined
      }
      bookings={tenant?.capabilities?.includes('table_management') === true}
    />
  );
}
function KeyWorkspace({
  token,
  canManage,
  hasAccess,
  bookings,
}: {
  token: string;
  canManage: boolean;
  hasAccess?: boolean;
  bookings: boolean;
}) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const result = await apiKeyRequest(token, '', 'GET', undefined, signal);
      if (alive.current && !signal?.aborted) setKeys(result.keys);
    },
    [token]
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    setError('');
    if (token && hasAccess !== false) {
      setLoading(true);
      void refresh(controller.signal)
        .catch((e) => {
          if (!controller.signal.aborted)
            setError(e instanceof Error ? e.message : 'Unable to load keys.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    } else setLoading(false);
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [refresh, token, hasAccess]);
  async function run(action: () => Promise<void>) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      return true;
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error ? e.message : 'Request failed. Please retry.'
        );
      return false;
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const create = (input: NewApiKey) =>
    run(async () => {
      const result = await apiKeyRequest<{ secret: string; key: ApiKey }>(
        token,
        '',
        'POST',
        input
      );
      if (!alive.current) return;
      setSecret(result.secret);
      setKeys((current) => [result.key, ...current]);
    });
  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <SettingsPageHeader
        title="API keys"
        description="Connect your business to inventory and reporting tools. Control what each integration can read, and revoke access whenever you need to."
      />
      {hasAccess === false ? (
        <div className="rounded-2xl border border-muted p-8">
          <PiKeyDuotone className="mb-4 size-9 text-primary" />
          <h2 className="text-lg font-semibold">
            API access is not included in your plan
          </h2>
          <p className="my-3 text-sm text-gray-500">
            Compare plans to find one with API access for your integrations.
          </p>
          <Link
            href="/settings/billing"
            className="text-sm font-semibold text-primary underline"
          >
            View billing and plans
          </Link>
        </div>
      ) : !token ? (
        <p role="status">Sign in to manage your business API keys.</p>
      ) : (
        <>
          {error && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <span>{error}</span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void run(() => refresh())}
              >
                Retry loading keys
              </Button>
            </div>
          )}
          {notice && (
            <p role="status" className="rounded-xl bg-gray-50 p-4 text-sm">
              {notice}
            </p>
          )}
          {secret && (
            <section className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-5 text-gray-900 dark:bg-gray-50">
              <h2 className="font-semibold">Save your new key</h2>
              <p className="text-sm">
                This is the only time the full secret is shown. Store it
                securely before closing this panel.
              </p>
              <input
                aria-label="New API secret"
                className="w-full rounded-lg border border-muted bg-white p-3 font-mono text-xs dark:bg-gray-50"
                readOnly
                value={secret}
                onFocus={(e) => e.target.select()}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(secret);
                      setNotice('API key copied.');
                    } catch {
                      setNotice(
                        'Copy was unavailable. Select the secret above and copy it manually.'
                      );
                    }
                  }}
                >
                  <PiCopyBold className="mr-2 size-4" />
                  Copy key
                </Button>
                <Button
                  size="sm"
                  variant="text"
                  onClick={() => {
                    setSecret('');
                    setNotice('');
                  }}
                >
                  I have saved it
                </Button>
              </div>
            </section>
          )}
          <div
            className={`grid items-start gap-6 ${canManage ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}
          >
            <KeyList
              keys={keys}
              loading={loading}
              error={error}
              canManage={canManage}
              busy={busy}
              revokeId={revokeId}
              setRevokeId={setRevokeId}
              onRevoke={(key) =>
                void run(async () => {
                  await apiKeyRequest(token, `/${key._id}`, 'DELETE');
                  if (!alive.current) return;
                  setKeys((current) =>
                    current.map((k) =>
                      k._id === key._id
                        ? { ...k, revokedAt: new Date().toISOString() }
                        : k
                    )
                  );
                  setRevokeId(null);
                  setNotice(`${key.name} access revoked.`);
                })
              }
            />
            {canManage && (
              <div className="space-y-4">
                <CreateKeyForm
                  busy={busy || loading || Boolean(secret)}
                  bookings={bookings}
                  onCreate={create}
                />
                <p className="flex gap-2 px-1 text-xs leading-5 text-gray-500">
                  <PiShieldCheckDuotone className="mt-0.5 size-5 shrink-0" />
                  Keys are read-only and limited to 60 requests per minute. Keep
                  secrets out of public websites and shared documents.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
