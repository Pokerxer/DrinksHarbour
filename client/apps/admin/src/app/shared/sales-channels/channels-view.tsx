'use client';
import { useState } from 'react';
import { useAuthorization } from '@/hooks/use-authorization';
import { type SalesChannel } from '@/services/market-foundation.service';
import {
  badgeClass,
  buttonClass,
  useFoundationWorkspace,
  WorkspaceStatus,
} from '../market-foundation/workspace';
import ChannelEditor from './channel-editor';
export default function ChannelsView() {
  const { user, role } = useAuthorization();
  if (!['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(role))
    return (
      <p role="alert">
        Manager access is required to read channel configuration.
      </p>
    );
  return (
    <Workspace
      key={`${role}:${user?.token}`}
      token={user?.token || ''}
      writable={role === 'super_admin'}
    />
  );
}
function Workspace({ token, writable }: { token: string; writable: boolean }) {
  const state = useFoundationWorkspace<{ channels: SalesChannel[] }>(
      token,
      '/sales-channels'
    ),
    [selected, setSelected] = useState('');
  const rows = state.data?.channels,
    row = rows?.find((value) => value._id === selected);
  return (
    <main className="space-y-4">
      <header className="rounded-xl border border-muted bg-gray-50 p-5 dark:bg-gray-100/30">
        <h1 className="text-2xl font-semibold">Sales channels</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Reviewed country, legal owner, payment account and pricing terms
          define new sales. Website, marketplace, POS and venue retain separate
          identities.
        </p>
      </header>
      <WorkspaceStatus error={state.error} notice={state.notice} />
      <button
        className={buttonClass}
        disabled={state.busy}
        onClick={state.reload}
      >
        Reload channels
      </button>
      {!state.data && !state.error && (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading channels…</span>
          {[0, 1].map((skeleton) => (
            <div
              className="space-y-2 rounded-xl border border-muted p-5"
              key={skeleton}
            >
              <span className="block h-4 w-40 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              <span className="block h-4 w-64 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
            </div>
          ))}
        </div>
      )}
      {rows && (
        <>
          {!rows.length && (
            <div className="rounded-xl border border-muted bg-gray-50 p-6 dark:bg-gray-100/30">
              <p className="font-medium">No configured channels.</p>
              {writable && (
                <p className="mt-1 text-sm text-gray-600">
                  Create one with “New channel” after the country and payment
                  ownership review is complete.
                </p>
              )}
            </div>
          )}
          <ul className="space-y-3">
            {rows.map((item) => (
              <li
                className="space-y-3 rounded-xl border border-muted p-5"
                key={item._id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold tabular-nums">
                    {item.code} / {item.market} / {item.currency}
                  </p>
                  <span
                    className={`${badgeClass} capitalize`}
                  >
                    {item.kind} · {item.active ? 'enabled' : 'inactive'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Version {item.version}. Payment provider:{' '}
                  {item.paymentOwner.provider}. Pricing terms:{' '}
                  {item.pricingPolicy.termsReference}
                </p>
                {writable && (
                  <button
                    className={buttonClass}
                    disabled={state.busy}
                    aria-pressed={selected === item._id}
                    onClick={() => setSelected(item._id)}
                  >
                    Edit channel
                  </button>
                )}
              </li>
            ))}
          </ul>
          {writable && (
            <>
              <button
                className={buttonClass}
                disabled={state.busy}
                onClick={() => setSelected('')}
              >
                New channel
              </button>
              <ChannelEditor
                key={row ? `${row._id}:${row.version}` : 'new'}
                initial={row}
                busy={state.busy}
                save={state.save}
              />
            </>
          )}
        </>
      )}
    </main>
  );
}
