'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import {
  foundationRequest,
  type MarketScope,
} from '@/services/market-foundation.service';
export const fieldClass =
  'mt-1 min-h-11 w-full rounded-lg border border-muted bg-transparent px-3 py-2 text-sm leading-6 text-gray-900 transition-colors duration-150 placeholder:text-gray-500 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-gray-500/5 disabled:opacity-60 dark:bg-gray-900/40 dark:text-gray-100 dark:disabled:bg-gray-900/70 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-red-400/30 motion-reduce:transition-none';
export const buttonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-muted bg-transparent px-4 py-2 text-sm font-medium text-gray-900 transition-all duration-150 hover:bg-gray-100 active:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:active:bg-transparent disabled:opacity-50 dark:text-gray-100 dark:hover:bg-gray-800 dark:active:bg-gray-700 motion-reduce:transition-none';
export const buttonDangerClass =
  `${buttonClass} border-red-300 bg-red-50 text-red-700 hover:bg-red-100 active:bg-red-200 disabled:bg-red-50 aria-pressed:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/70`;
/** alias kept for workspaces already using the danger variant by this name */
export const dangerButtonClass = buttonDangerClass;
export const buttonPrimaryClass =
  `${buttonClass} bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-950 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white disabled:bg-gray-400 dark:disabled:bg-gray-700`;
export const helperClass =
  'mt-1 block text-xs leading-5 text-gray-500 dark:text-gray-400';
export const fieldErrorClass =
  'mt-1 block text-xs leading-5 font-medium text-red-700 dark:text-red-300';
export const badgeClass =
  'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium leading-5 text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700';
export const spinnerClass =
  'inline-block size-4 shrink-0 motion-safe:animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:border-solid';
export function BusySpinner() {
  return <span aria-hidden="true" className={spinnerClass} />;
}
export function Field({
  label,
  hint,
  error,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  /** span both columns inside the sm:grid editor grids */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={wide ? 'block sm:col-span-2' : 'block'}>
      <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </span>
      {children}
      {error ? (
        <span role="alert" className={fieldErrorClass}>
          {error}
        </span>
      ) : hint ? (
        <span className={helperClass}>{hint}</span>
      ) : null}
    </label>
  );
}
/** Warn before an unload while an approved editor draft is unsaved. */
export function useUnsavedGuard(
  dirty: boolean,
  message = 'Unsaved review changes will be discarded.'
) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = message;
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, message]);
}
/** Move focus to the first blur-validated field marked aria-invalid. */
export function focusFirstInvalid(form: HTMLFormElement | null) {
  if (!form) return;
  requestAnimationFrame(() => {
    form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  });
}
export function useFoundationWorkspace<T>(token: string, path: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    if (token)
      void foundationRequest<T>(
        token,
        path,
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
              e instanceof Error ? e.message : 'Unable to load configuration'
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    else setLoading(false);
    return () => controller.abort();
  }, [token, path, reload]);
  async function save(target: string, body: unknown, method = 'POST') {
    if (lock.current || loading || !token) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await foundationRequest(token, target, method, body);
      setNotice('Saved. Current records are being refreshed.');
      setReload((value) => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return {
    data,
    error,
    notice,
    busy: busy || loading,
    save,
    reload: () => setReload((value) => value + 1),
  };
}
export function WorkspaceStatus({
  error,
  notice,
}: {
  error: string;
  notice: string;
}) {
  return (
    <>
      {error && (
        <p
          role="alert"
          className="my-3 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-1 size-4 shrink-0"
          />
          <span>{error}</span>
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="my-3 flex items-start gap-2 rounded-lg border border-green-300 bg-green-50 p-4 text-sm leading-6 text-green-800 dark:border-green-900/60 dark:bg-green-950/20 dark:text-green-300"
        >
          <CircleCheck
            aria-hidden="true"
            className="mt-1 size-4 shrink-0"
          />
          <span>{notice}</span>
        </p>
      )}
    </>
  );
}
export function ScopeFields({
  value,
  onChange,
}: {
  value: MarketScope;
  onChange: (value: MarketScope) => void;
}) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-3">
      <legend className="sr-only">Enrollment scope</legend>
      <Field label="Market code" hint="Two-letter country code, e.g. NG">
        <input
          className={fieldClass}
          required
          minLength={2}
          maxLength={2}
          value={value.market}
          onChange={(e) =>
            onChange({ ...value, market: e.target.value.toUpperCase() })
          }
        />
      </Field>
      <Field label="Category">
        <select
          className={fieldClass}
          value={value.category}
          onChange={(e) =>
            onChange({
              ...value,
              category: e.target.value as MarketScope['category'],
            })
          }
        >
          <option value="beverage">Beverages</option>
          <option value="gift">Gifts</option>
          <option value="food">Food</option>
        </select>
      </Field>
      <Field label="Enrollment channel">
        <select
          className={fieldClass}
          value={value.channel}
          onChange={(e) =>
            onChange({
              ...value,
              channel: e.target.value as MarketScope['channel'],
            })
          }
        >
          <option value="marketplace">Marketplace</option>
          <option value="storefront">Independent storefront</option>
        </select>
      </Field>
    </fieldset>
  );
}
