'use client';
import { useState } from 'react';
import { useAuthorization } from '@/hooks/use-authorization';
import { type Enrollment } from '@/services/market-foundation.service';
import {
  badgeClass,
  buttonClass,
  useFoundationWorkspace,
  WorkspaceStatus,
} from '../market-foundation/workspace';
import { ApplicationForm, ReviewForm } from './enrollment-forms';
import PolicyEditor from './policy-editor';
export default function EnrollmentView() {
  const { user, role } = useAuthorization();
  if (!['super_admin', 'tenant_owner', 'tenant_admin'].includes(role))
    return (
      <p role="alert">
        Tenant owner or super-admin access is required to manage enrollment.
      </p>
    );
  return (
    <Workspace
      key={`${role}:${user?.token}`}
      token={user?.token || ''}
      admin={role === 'super_admin'}
    />
  );
}
function Workspace({ token, admin }: { token: string; admin: boolean }) {
  const state = useFoundationWorkspace<Enrollment[]>(
      token,
      admin ? '/market-enrollments' : '/market-enrollments/mine'
    ),
    [selected, setSelected] = useState('');
  const row = state.data?.find((value) => value._id === selected);
  return (
    <main className="space-y-4">
      <header className="rounded-xl border border-muted bg-gray-50 p-5 dark:bg-gray-100/30">
        <h1 className="text-2xl font-semibold">Market enrollment</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Marketplace, independent storefront and ERM subscription approvals
          remain separate. Existing accepted orders retain their fulfillment
          workflow.
        </p>
      </header>
      <WorkspaceStatus error={state.error} notice={state.notice} />
      <button
        className={buttonClass}
        disabled={state.busy}
        onClick={state.reload}
      >
        Reload applications
      </button>
      {!state.data && !state.error && (
        <div role="status" aria-live="polite" className="space-y-3">
          <span className="sr-only">Loading applications…</span>
          {[0, 1].map((skeleton) => (
            <div
              className="space-y-2 rounded-xl border border-muted p-5"
              key={skeleton}
            >
              <span className="block h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
              <span className="block h-4 w-72 animate-pulse rounded bg-gray-100 dark:bg-gray-800/70" />
            </div>
          ))}
        </div>
      )}
      {state.data && (
        <>
          {!state.data.length && (
            <div className="rounded-xl border border-muted bg-gray-50 p-6 dark:bg-gray-100/30">
              <p className="font-medium">No applications yet.</p>
              <p className="mt-1 text-sm text-gray-600">
                Apply below with your reviewed scope; approvals stay separate
                from your ERM subscription.
              </p>
            </div>
          )}
          <ul className="space-y-3">
            {state.data.map((item) => (
              <li
                key={item._id}
                className="space-y-3 rounded-xl border border-muted p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {item.market} / {item.category} / {item.channel}
                  </span>
                  <span className={`${badgeClass} capitalize`}>
                    {item.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Version {item.version}. {item.reason}
                </p>
                {admin && (
                  <>
                    <p className="text-sm">Merchant: {item.tenant}</p>
                    <button
                      className={buttonClass}
                      disabled={state.busy}
                      aria-pressed={selected === item._id}
                      onClick={() => setSelected(item._id)}
                    >
                      Review application
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {admin ? (
            row && (
              <ReviewForm
                key={row._id}
                row={row}
                busy={state.busy}
                save={state.save}
              />
            )
          ) : (
            <ApplicationForm
              rows={state.data}
              busy={state.busy}
              save={state.save}
            />
          )}
        </>
      )}
      {admin && <PolicyEditor token={token} />}
    </main>
  );
}
