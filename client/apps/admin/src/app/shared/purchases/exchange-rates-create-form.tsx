'use client';

import { CurrencySelect, INPUT_CLS } from './exchange-rates-widgets';
import { fmtRate } from './exchange-rates-helpers';

/**
 * Create/upsert form for an exchange rate. The server upserts on
 * (pair, effectiveDate), which the hint text reflects. `backDated` is
 * computed by the parent via isBackDated() and warns when a newer active rate
 * would shadow this entry.
 */
export function ExchangeRatesCreateForm({
  fromCurrency,
  toCurrency,
  rate,
  effectiveDate,
  notes,
  saving,
  backDated,
  onChange,
  onSave,
  onClose,
}: {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveDate: string;
  notes: string;
  saving: boolean;
  backDated: boolean;
  onChange: (patch: {
    fromCurrency?: string;
    toCurrency?: string;
    rate?: string;
    effectiveDate?: string;
    notes?: string;
  }) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const parsedRate = Number(rate);
  const inversePreview =
    rate.trim() !== '' && Number.isFinite(parsedRate) && parsedRate > 0
      ? 1 / parsedRate
      : null;

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            From
          </label>
          <CurrencySelect
            value={fromCurrency}
            onChange={(v) => onChange({ fromCurrency: v })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            To
          </label>
          <CurrencySelect
            value={toCurrency}
            onChange={(v) => onChange({ toCurrency: v })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Rate (1 {fromCurrency} = ? {toCurrency})
          </label>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={rate}
            onChange={(e) => onChange({ rate: e.target.value })}
            placeholder="e.g. 1550"
            className={INPUT_CLS}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Effective Date
          </label>
          <input
            type="date"
            value={effectiveDate}
            onChange={(e) => onChange({ effectiveDate: e.target.value })}
            className={INPUT_CLS}
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Notes <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            value={notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            maxLength={500}
            placeholder="e.g. CBN official rate"
            className={INPUT_CLS}
          />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {fromCurrency === toCurrency ? (
            <span className="font-medium text-amber-600">
              From and To must be different
            </span>
          ) : backDated ? (
            <span className="font-medium text-amber-600">
              A newer active rate already exists for this pair — a back-dated
              entry will be saved but never applied (latest wins)
            </span>
          ) : inversePreview !== null ? (
            <>
              Inverse: 1 {toCurrency} = {fmtRate(inversePreview)}{' '}
              {fromCurrency} · saving the same pair and date updates the
              existing rate
            </>
          ) : (
            'Saving the same pair and date again updates the existing rate'
          )}
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-lg bg-[#b20202] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#9a0101] disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Rate'}
          </button>
        </div>
      </div>
    </div>
  );
}
