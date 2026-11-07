'use client';
import {
  type ChannelConfiguration,
  type PaymentOwner,
} from '@/services/market-foundation.service';
import {
  buttonClass,
  fieldClass,
  fieldErrorClass,
  helperClass,
} from '../market-foundation/workspace';
const providers = [
  'paystack',
  'korapay',
  'stripe',
  'wallet',
  'gift_card',
  'cash_on_delivery',
  'bank_transfer',
  'cash',
  'manual',
];
export default function PaymentFields({
  draft,
  change,
  errors = {},
  blur,
}: {
  draft: ChannelConfiguration;
  change: <K extends keyof ChannelConfiguration>(
    key: K,
    value: ChannelConfiguration[K]
  ) => void;
  errors?: Record<string, string>;
  blur?: (key: string, value: string) => void;
}) {
  const platform = draft.kind === 'marketplace';
  const additional = draft.allowedPaymentOwners || [];
  function setAdditional(index: number, patch: Partial<PaymentOwner>) {
    change(
      'allowedPaymentOwners',
      additional.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Primary payment provider
          <select
            className={fieldClass}
            value={draft.paymentOwner.provider}
            onChange={(e) =>
              change('paymentOwner', {
                ...draft.paymentOwner,
                provider: e.target.value,
              })
            }
          >
            {providers.map((provider) => (
              <option key={provider}>{provider}</option>
            ))}
          </select>
        </label>
        <label>
          Reviewed payment account reference
          <input
            className={fieldClass}
            required
            pattern="[A-Za-z][A-Za-z0-9_-]{1,79}"
            value={draft.paymentOwner.account || ''}
            aria-invalid={errors.account ? true : undefined}
            onBlur={(e) => blur?.('account', e.target.value)}
            onChange={(e) =>
              change('paymentOwner', {
                ...draft.paymentOwner,
                account: e.target.value,
              })
            }
          />
          <span
            aria-live="polite"
            className={errors.account ? fieldErrorClass : helperClass}
          >
            {errors.account ||
              'References existing server credentials; nothing is provisioned here.'}
          </span>
        </label>
      </div>
      <p>
        Account references identify existing server credentials; entering a
        reference does not provision or certify an account. Marketplace adapters
        currently use the reference “platform”.
      </p>
      {platform && (
        <fieldset className="space-y-2">
          <legend>Additional reviewed payment methods</legend>
          {additional.map((row, index) => (
            <div className="flex flex-wrap gap-2" key={index}>
              <label>
                Additional provider {index + 1}
                <select
                  className={fieldClass}
                  value={row.provider}
                  onChange={(e) =>
                    setAdditional(index, { provider: e.target.value })
                  }
                >
                  {providers.map((provider) => (
                    <option key={provider}>{provider}</option>
                  ))}
                </select>
              </label>
              <label>
                Additional account {index + 1}
                <input
                  className={fieldClass}
                  required
                  value={row.account || ''}
                  onChange={(e) =>
                    setAdditional(index, { account: e.target.value })
                  }
                />
              </label>
              <button
                className={buttonClass}
                type="button"
                onClick={() =>
                  change(
                    'allowedPaymentOwners',
                    additional.filter((_, i) => i !== index)
                  )
                }
              >
                Remove method {index + 1}
              </button>
            </div>
          ))}
          <button
            className={buttonClass}
            type="button"
            disabled={additional.length >= 12}
            onClick={() =>
              change('allowedPaymentOwners', [
                ...additional,
                {
                  ...draft.paymentOwner,
                  provider: 'wallet',
                  account: 'platform',
                },
              ])
            }
          >
            Add reviewed method
          </button>
        </fieldset>
      )}
    </>
  );
}
