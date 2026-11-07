'use client';
import { useRef, useState } from 'react';
import {
  type ChannelConfiguration,
  type SalesChannel,
} from '@/services/market-foundation.service';
import PaymentFields from './payment-fields';
import { blank, configuration } from './channel-form';
import {
  BusySpinner,
  buttonClass,
  fieldClass,
  fieldErrorClass,
  helperClass,
  focusFirstInvalid,
  useUnsavedGuard,
} from '../market-foundation/workspace';
const validators: Record<
  string,
  (value: string) => string
> = {
  code: (value) =>
    /^[A-Z][A-Z0-9_]{2,39}$/.test(value)
      ? ''
      : 'Start with A–Z, then 2–39 of A–Z, 0–9 or _ (e.g. WEB_NG).',
  market: (value) =>
    /^[A-Za-z]{2}$/.test(value)
      ? ''
      : 'Use the two-letter country code, e.g. NG.',
  currency: (value) =>
    /^[A-Za-z]{3}$/.test(value)
      ? ''
      : 'Use the three-letter currency, e.g. NGN.',
  tenant: (value) =>
    /^[a-fA-F0-9]{24}$/.test(value)
      ? ''
      : 'Enter the 24-character reviewed merchant identifier.',
  owner: (value) =>
    value.trim() ? '' : 'Add the reviewed legal entity reference.',
  account: (value) =>
    /^[A-Za-z][A-Za-z0-9_-]{1,79}$/.test(value)
      ? ''
      : 'Reference the existing server credentials (letters, digits, _ or -).',
};
export default function ChannelEditor({
  initial,
  busy,
  save,
}: {
  initial?: SalesChannel;
  busy: boolean;
  save: (path: string, body: unknown, method?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ChannelConfiguration>(() =>
      initial ? configuration(initial) : blank()
    ),
    [reason, setReason] = useState(''),
    [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null),
    base = useRef(JSON.stringify({ draft, reason }));
  const unsaved =
    JSON.stringify({ draft, reason }) !== base.current;
  useUnsavedGuard(unsaved);
  const identity = initial !== undefined,
    platform = draft.kind === 'marketplace';
  function change<K extends keyof ChannelConfiguration>(
    key: K,
    value: ChannelConfiguration[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  function blur(key: string, value: string) {
    const validator = validators[key];
    if (!validator) return;
    setErrors((current) => ({ ...current, [key]: validator(value) }));
  }
  const setOwner = (reference: string) =>
    setDraft((current) => ({
      ...current,
      legalOwner: { type: platform ? 'platform' : 'tenant', reference },
      paymentOwner: {
        ...current.paymentOwner,
        type: platform ? 'platform' : 'tenant',
        reference,
      },
      allowedPaymentOwners: current.allowedPaymentOwners?.map((row) => ({
        ...row,
        type: platform ? 'platform' : 'tenant',
        reference,
      })),
    }));
  function collectErrors(): Record<string, string> {
    const collected: Record<string, string> = {
      code: validators.code(draft.code),
      market: validators.market(draft.market),
      currency: validators.currency(draft.currency),
      account: validators.account(draft.paymentOwner.account || ''),
      owner: validators.owner(draft.legalOwner.reference),
    };
    if (!platform && !identity)
      collected.tenant = validators.tenant(draft.tenant || '');
    return collected;
  }
  return (
    <form
      ref={formRef}
      className="space-y-5 rounded-xl border border-muted p-4 sm:p-6"
      onSubmit={(e) => {
        e.preventDefault();
        const collected = collectErrors();
        setErrors(collected);
        if (Object.values(collected).some(Boolean)) {
          focusFirstInvalid(formRef.current);
          return;
        }
        void save(
          initial ? `/sales-channels/${initial._id}` : '/sales-channels',
          {
            configuration: draft,
            reason,
            ...(initial ? { expectedVersion: initial.version } : {}),
          },
          initial ? 'PUT' : 'POST'
        );
      }}
    >
      <h2 className="text-lg font-semibold">
        {initial
          ? `Edit ${initial.code} (version ${initial.version})`
          : 'Configure a reviewed channel'}
      </h2>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Identity — fixed for the channel lifetime
        </legend>
        <label>
          Channel kind
          <select
            className={fieldClass}
            disabled={identity}
            value={draft.kind}
            onChange={(e) => {
              const kind = e.target.value as ChannelConfiguration['kind'];
              const next = blank();
              setDraft({
                ...next,
                kind,
                tenant: kind === 'marketplace' ? null : '',
                legalOwner: {
                  type: kind === 'marketplace' ? 'platform' : 'tenant',
                  reference: '',
                },
                paymentOwner: {
                  type: kind === 'marketplace' ? 'platform' : 'tenant',
                  reference: '',
                  provider: ['storefront', 'marketplace'].includes(kind)
                    ? 'paystack'
                    : 'cash',
                  account: '',
                },
              });
            }}
          >
            <option value="marketplace">Marketplace</option>
            <option value="storefront">Independent storefront</option>
            <option value="pos">POS</option>
            <option value="venue">Venue</option>
          </select>
        </label>
        <label>
          Channel code
          <input
            className={fieldClass}
            required
            disabled={identity}
            pattern="[A-Z][A-Z0-9_]{2,39}"
            value={draft.code}
            aria-invalid={errors.code ? true : undefined}
            aria-describedby="channel-code-help"
            onBlur={(e) => blur('code', e.target.value)}
            onChange={(e) => change('code', e.target.value.toUpperCase())}
          />
          <span id="channel-code-help" aria-live="polite" className={errors.code ? fieldErrorClass : helperClass}>
            {errors.code ||
              'Stable identifier used across orders and reports.'}
          </span>
        </label>
        <label>
          Country code
          <input
            className={fieldClass}
            required
            disabled={identity}
            minLength={2}
            maxLength={2}
            value={draft.market}
            aria-invalid={errors.market ? true : undefined}
            onBlur={(e) => blur('market', e.target.value)}
            onChange={(e) => change('market', e.target.value.toUpperCase())}
          />
        </label>
        <label>
          Transaction currency
          <input
            className={fieldClass}
            required
            pattern="[A-Z]{3}"
            value={draft.currency}
            aria-invalid={errors.currency ? true : undefined}
            onBlur={(e) => blur('currency', e.target.value)}
            onChange={(e) => change('currency', e.target.value.toUpperCase())}
          />
        </label>
        {!platform && (
          <label className="sm:col-span-2">
            Merchant identifier
            <input
              className={fieldClass}
              required
              disabled={identity}
              aria-invalid={errors.tenant ? true : undefined}
              pattern="[a-fA-F0-9]{24}"
              value={draft.tenant || ''}
              onBlur={(e) => blur('tenant', e.target.value)}
              onChange={(e) => {
                const reference = e.target.value;
                setDraft((current) => ({
                  ...current,
                  tenant: reference,
                  legalOwner: { type: 'tenant', reference },
                  paymentOwner: {
                    ...current.paymentOwner,
                    type: 'tenant',
                    reference,
                  },
                }));
              }}
            />
            <span className={helperClass}>
              The reviewed merchant that legally owns and fulfils sales in this
              channel.
            </span>
          </label>
        )}
        {platform && (
          <label className="sm:col-span-2">
            Reviewed platform legal entity reference
            <input
              className={fieldClass}
              required
              maxLength={160}
              value={draft.legalOwner.reference}
              aria-invalid={errors.owner ? true : undefined}
              onBlur={(e) => blur('owner', e.target.value)}
              onChange={(e) => setOwner(e.target.value)}
            />
          </label>
        )}
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Payment ownership
        </legend>
        <PaymentFields
          draft={draft}
          change={change}
          errors={errors}
          blur={blur}
        />
      </fieldset>
      {draft.kind === 'storefront' && (
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Storefront links
          </legend>
          {(['storefrontChannel', 'apiKey', 'location'] as const).map((key) => (
            <label key={key}>
              {key === 'storefrontChannel'
                ? 'Existing website channel'
                : key === 'apiKey'
                  ? 'Issuing API key identifier'
                  : 'Stock location identifier'}
              <input
                className={fieldClass}
                required
                disabled={identity}
                pattern="[a-fA-F0-9]{24}"
                value={draft[key] || ''}
                onChange={(e) => change(key, e.target.value)}
              />
              <span className={helperClass}>
                24-character identifier from the existing website setup.
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Reviewed pricing terms
        </legend>
        <label>
          Pricing policy code
          <input
            className={fieldClass}
            required
            pattern="[A-Z][A-Z0-9_]{2,59}"
            value={draft.pricingPolicy.code}
            onChange={(e) =>
              change('pricingPolicy', {
                ...draft.pricingPolicy,
                code: e.target.value.toUpperCase(),
              })
            }
          />
        </label>
        <label>
          Pricing policy version
          <input
            className={fieldClass}
            required
            type="number"
            min={1}
            step={1}
            value={draft.pricingPolicy.version}
            onChange={(e) =>
              change('pricingPolicy', {
                ...draft.pricingPolicy,
                version: Number(e.target.value),
              })
            }
          />
        </label>
        <label>
          Reviewed pricing terms reference
          <input
            className={fieldClass}
            required
            maxLength={160}
            value={draft.pricingPolicy.termsReference}
            onChange={(e) =>
              change('pricingPolicy', {
                ...draft.pricingPolicy,
                termsReference: e.target.value,
              })
            }
          />
        </label>
      </fieldset>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          className="size-4"
          checked={draft.active}
          onChange={(e) => change('active', e.target.checked)}
        />
        Enable reviewed channel for new commitments
      </label>
      <p className="max-w-2xl text-sm leading-6 text-gray-600">
        Identity changes require migration. Existing paid orders keep their
        stored terms. Saving does not change current prices or activate
        production.
      </p>
      <label className="block">
        Channel review reason
        <textarea
          className={fieldClass}
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <span className={helperClass}>
          Recorded with this revision for the audit trail (5–1000 characters).
        </span>
      </label>
      {unsaved && (
        <p
          role="status"
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          Unsaved channel draft — save or reload before navigating away.
        </p>
      )}
      <button className={buttonClass} disabled={busy}>
        {busy ? (
          <>
            <BusySpinner /> Saving channel…
          </>
        ) : (
          'Save channel'
        )}
      </button>
    </form>
  );
}
