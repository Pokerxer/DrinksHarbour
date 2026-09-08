import React from 'react';
import { Button } from 'rizzui';
import { PiKeyDuotone } from 'react-icons/pi';
import { getKeyStatus, type ApiKey } from '@/services/api-key.service';
export default function KeyList({
  keys,
  loading,
  error,
  canManage,
  busy,
  revokeId,
  setRevokeId,
  onRevoke,
}: {
  keys: ApiKey[];
  loading: boolean;
  error: string;
  canManage: boolean;
  busy: boolean;
  revokeId: string | null;
  setRevokeId: (id: string | null) => void;
  onRevoke: (key: ApiKey) => void;
}) {
  const active = keys.filter((key) => getKeyStatus(key) === 'Active').length;
  return (
    <section className="overflow-hidden rounded-2xl border border-muted bg-white dark:bg-gray-50">
      <div className="flex items-center justify-between border-b border-muted p-5">
        <div>
          <h2 className="text-lg font-semibold">Your integrations</h2>
          <p className="mt-1 text-sm text-gray-500">
            {loading
              ? 'Loading your keys…'
              : `${active} active · ${keys.length} total`}
          </p>
        </div>
        <PiKeyDuotone className="size-7 text-gray-400" />
      </div>
      {loading ? (
        <p role="status" className="p-8 text-sm">
          Loading API keys…
        </p>
      ) : !keys.length ? (
        <div className="px-6 py-12 text-center">
          <PiKeyDuotone className="mx-auto mb-4 size-10 text-gray-400" />
          <h3 className="font-semibold">
            {error ? 'Keys could not be loaded' : 'No API keys yet'}
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {error
              ? 'Retry to see your integrations.'
              : canManage
                ? 'Create a key to connect your first integration.'
                : 'A settings administrator can create an integration key.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-muted">
          {keys.map((key) => {
            const status = getKeyStatus(key);
            return (
              <li key={key._id} className="space-y-3 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold">{key.name}</h3>
                    <p className="mt-1 font-mono text-xs text-gray-500">
                      {key.prefix}••••••••
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {key.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-600"
                    >
                      {scope === 'inventory:read'
                        ? 'Read inventory'
                        : scope === 'bookings:read'
                          ? 'Read bookings'
                          : scope}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-gray-500">
                    {status === 'Expired' ? 'Expired' : 'Expires'}{' '}
                    {new Date(key.expiresAt).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  {canManage && status === 'Active' && (
                    <Button
                      size="sm"
                      variant="text"
                      className="text-red-600"
                      disabled={busy}
                      onClick={() => setRevokeId(key._id)}
                    >
                      Revoke access
                    </Button>
                  )}
                </div>
                {revokeId === key._id && (
                  <div className="rounded-lg border border-red-200 p-3">
                    <p className="mb-3 text-sm">
                      Revoke {key.name}? This integration will stop working
                      immediately.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        color="danger"
                        disabled={busy}
                        isLoading={busy}
                        onClick={() => onRevoke(key)}
                      >
                        Confirm revoke
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setRevokeId(null)}
                      >
                        Keep key
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
