'use client';
import { useState } from 'react';
import { Button, Input } from 'rizzui';
import type { NewApiKey } from '@/services/api-key.service';

export default function CreateKeyForm({
  busy,
  bookings,
  onCreate,
}: {
  busy: boolean;
  bookings: boolean;
  onCreate: (input: NewApiKey) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(['inventory:read']);
  const [expiresInDays, setExpiry] = useState(90);
  return (
    <form
      className="rounded-2xl border border-muted bg-white p-5 dark:bg-gray-50 sm:p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || !name.trim() || !scopes.length) return;
        if (await onCreate({ name: name.trim(), scopes, expiresInDays }))
          setName('');
      }}
    >
      <h2 className="text-lg font-semibold">Create an API key</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">
        Give each integration its own key so you can manage access separately.
      </p>
      <fieldset disabled={busy} className="mt-6 space-y-5 disabled:opacity-60">
        <Input
          label="Integration name"
          placeholder="e.g. Stock reporting"
          maxLength={80}
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Permissions</legend>
          {['inventory:read', ...(bookings ? ['bookings:read'] : [])].map(
            (scope) => (
              <label
                key={scope}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-muted p-3"
              >
                <input
                  className="mt-1 rounded text-primary focus:ring-primary"
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={(e) =>
                    setScopes((current) =>
                      e.target.checked
                        ? [...current, scope]
                        : current.filter((s) => s !== scope)
                    )
                  }
                />
                <span>
                  <span className="block text-sm font-medium">
                    {scope === 'inventory:read'
                      ? 'Read inventory'
                      : 'Read bookings'}
                  </span>
                  <span className="text-xs text-gray-500">
                    View records without changing them
                  </span>
                </span>
              </label>
            )
          )}
        </fieldset>
        <label className="block text-sm font-medium">
          Expires after
          <select
            className="mt-2 w-full rounded-lg border-muted bg-transparent text-sm focus:border-primary focus:ring-primary"
            value={expiresInDays}
            onChange={(e) => setExpiry(Number(e.target.value))}
          >
            {[30, 90, 365].map((days) => (
              <option key={days} value={days}>
                {days} days{days === 90 ? ' (recommended)' : ''}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="submit"
          className="w-full"
          isLoading={busy}
          disabled={busy || !name.trim() || !scopes.length}
        >
          Create key
        </Button>
      </fieldset>
    </form>
  );
}
