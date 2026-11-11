'use client';
import { useCallback, useRef, useState } from 'react';
import { useAuthorization } from '@/hooks/use-authorization';
import {
  merchantRequest,
  formatMerchantMoney,
} from '@/services/merchant-order.service';
import {
  badgeClass,
  buttonClass,
  WorkspaceStatus,
} from '../market-foundation/workspace';
import MerchantRefundPanel from './merchant-refund-panel';
import SalesSummary from './sales-summary';
import { useMerchantQueue } from './use-merchant-queue';
import QueueControls from './queue-controls';
import QuantityRefundPanel from './quantity-refund-panel';
import QuantityPanel from './quantity-panel';
import LocalDispatchPanel from './local-dispatch-panel';
import CarrierPanel from './carrier-panel';
const labels = {
  accept: 'Accept order',
  pick: 'Start picking',
  ship: 'Ship order',
  deliver: 'Confirm delivered',
  cancel: 'Cancel own order',
};
export default function MerchantOrdersView() {
  const { user, role } = useAuthorization();
  if (
    ![
      'super_admin',
      'admin',
      'tenant_owner',
      'tenant_admin',
      'tenant_staff',
    ].includes(role)
  )
    return <p role="alert">Merchant staff access is required.</p>;
  if (!user?.token) return <p role="alert">Sign in to view merchant orders.</p>;
  return (
    <Queue
      key={`${role}:${user.token}`}
      token={user.token}
      platform={['super_admin', 'admin'].includes(role)}
    />
  );
}
function Queue({ token, platform }: { token: string; platform: boolean }) {
  const {
    rows,
    error: readError,
    loading,
    pagination,
    state,
    setState,
    page,
    setPage,
    reload,
  } = useMerchantQueue(token);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  const lock = useRef(false),
    keys = useRef(new Map<string, string>());
  const working = busy || loading;
  const save = useCallback(
    async (
      path: string,
      payload: Record<string, unknown>,
      identity: string
    ) => {
      if (lock.current) return false;
      lock.current = true;
      setBusy(true);
      setError('');
      setNotice('');
      let key = keys.current.get(identity);
      if (!key) {
        key = crypto.randomUUID();
        keys.current.set(identity, key);
      }
      try {
        await merchantRequest(token, path, 'POST', {
          ...payload,
          ...(identity.startsWith('execute:') ||
          identity.startsWith('reconcile:')
            ? {}
            : { idempotencyKey: key }),
        });
        setNotice('Saved. Refreshing current merchant records.');
        reload();
        return true;
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'Unable to save merchant operation'
        );
        return false;
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [token, reload]
  );
  return (
    <main className="space-y-5">
      <header className="rounded-xl border border-muted bg-gray-50 p-5 dark:bg-gray-100/30">
        <h1 className="text-2xl font-semibold">Merchant fulfillment</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
          Accept, prepare and fulfill each merchant allocation independently.
          Parent totals stay shared; these records show permitted merchant
          lines.
        </p>
      </header>
      <SalesSummary token={token} />
      <WorkspaceStatus error={error || readError} notice={notice} />
      {readError && !error && (
        <div className="flex flex-wrap items-center gap-3">
          <button className={buttonClass} disabled={working} onClick={reload}>
            Retry queue read
          </button>
          <p className="text-sm text-gray-600">
            Reload the queue once the network is reachable.
          </p>
        </div>
      )}
      <button className={buttonClass} disabled={working} onClick={reload}>
        Refresh queue
      </button>
      <QueueControls
        state={state}
        setState={setState}
        page={page}
        setPage={setPage}
        pagination={pagination}
        busy={busy}
        loading={loading}
      />
      {loading && (
        <div role="status" aria-live="polite" className="space-y-4">
          <span className="sr-only">Loading merchant orders…</span>
          {[0, 1].map((skeleton) => (
            <div
              className="space-y-4 rounded-xl border border-muted p-4 sm:p-6"
              key={skeleton}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="h-5 w-44 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
                <span className="h-6 w-32 animate-pulse rounded-full bg-gray-100 dark:bg-gray-800" />
              </div>
              <span className="block h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/70" />
              <div className="flex flex-wrap gap-2">
                <span className="h-11 w-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
                <span className="h-11 w-28 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      )}
      {rows?.length === 0 && !loading && (
        <div className="rounded-xl border border-muted bg-gray-50 p-8 text-center dark:bg-gray-100/30">
          <p className="font-medium">No orders match this queue page.</p>
          <p className="mt-1 text-sm text-gray-600">
            Try another status or page; legacy orders remain in Orders.
          </p>
          <button
            className={buttonClass}
            disabled={working}
            onClick={reload}
          >
            Refresh queue
          </button>
        </div>
      )}
      {rows?.map((row) => {
        const actions: (keyof typeof labels)[] =
          row.state === 'pending'
            ? ['accept', 'cancel']
            : row.state === 'accepted'
              ? ['pick', 'ship', 'cancel']
              : row.state === 'picking'
                ? ['ship', 'cancel']
                : row.state === 'shipped'
                  ? ['deliver']
                  : [];
        return (
          <article
            className="space-y-4 overflow-hidden rounded-xl border border-muted p-4 shadow-sm sm:p-6"
            key={row._id}
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold">
                Order {row.orderNumber || row.order}
              </h2>
              <span
                className={`${badgeClass} tabular-nums`}
              >
                {row.state} ·{' '}
                {formatMerchantMoney(row.totalMinor, row.currency)}
              </span>
            </div>
            {row.recipient && (
              <div>
                <p>{row.recipient.fullName}</p>
                <p>
                  {[
                    row.recipient.phone,
                    row.recipient.addressLine1,
                    row.recipient.city,
                    row.recipient.state,
                    row.recipient.country,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            )}
            <ul className="space-y-2 rounded-lg bg-gray-50 p-4 text-sm dark:bg-gray-100/30">
              {row.lines.map((line) => (
                <li className="break-words leading-6" key={line.line}>
                  <span>{line.productName || `Product ${line.product}`}</span> ·{' '}
                  {line.quantity} × {line.sizeName || line.size}
                  {line.sku ? ` · ${line.sku}` : ''} ·{' '}
                  {formatMerchantMoney(line.merchandiseMinor, row.currency)}
                </li>
              ))}
            </ul>
            <p className="text-sm tabular-nums leading-6 text-gray-600">
              Merchandise{' '}
              {formatMerchantMoney(row.merchandiseMinor, row.currency)} ·
              Shipping {formatMerchantMoney(row.shippingMinor, row.currency)} ·
              Tax {formatMerchantMoney(row.taxMinor, row.currency)}
            </p>
            <div className="flex flex-wrap gap-2">
              {actions
                .filter(
                  (action) =>
                    row.fulfillmentVersion !== 2 ||
                    !['ship', 'deliver', 'cancel'].includes(action)
                )
                .map((action) => (
                  <button
                    className={buttonClass}
                    disabled={
                      working ||
                      (action === 'ship' &&
                        (row.refundedMinor > 0 || row.refundReservedMinor > 0))
                    }
                    key={action}
                    onClick={() =>
                      void save(
                        `/${row._id}/actions`,
                        { action, expectedVersion: row.version },
                        `${row._id}:${action}:${row.version}`
                      )
                    }
                  >
                    {labels[action]}
                  </button>
                ))}
            </div>
            {row.fulfillmentVersion === 2 && (
              <>
                <QuantityPanel
                  row={row}
                  token={token}
                  busy={working}
                  save={save}
                />
                <QuantityRefundPanel row={row} busy={working} save={save} />
                <LocalDispatchPanel row={row} token={token} onChange={reload} />
                <CarrierPanel row={row} token={token} platform={platform} />
              </>
            )}
            <MerchantRefundPanel
              key={`${row._id}:${row.refundedMinor}:${row.refundReservedMinor}`}
              token={token}
              row={row}
              platform={platform}
              busy={working}
              save={save}
            />
          </article>
        );
      })}
    </main>
  );
}
