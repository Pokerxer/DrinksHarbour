'use client';

import { useState } from 'react';
import {
  PiArrowsLeftRight,
  PiCaretDown,
  PiCurrencyCircleDollar,
  PiTrendUp,
} from 'react-icons/pi';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { BASE_CURRENCY, CURRENCIES, CURRENCY_SYMBOLS } from './types';
import { fmtRate, fmtMoney, formatRateDate } from './exchange-rates-helpers';

export const INPUT_CLS =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#b20202] focus:outline-none';
export const SELECT_CLS = `appearance-none pr-8 ${INPUT_CLS}`;

export function CurrencySelect({
  value,
  onChange,
  allowAll = false,
  allLabel = 'All',
}: {
  value: string;
  onChange: (v: string) => void;
  allowAll?: boolean;
  allLabel?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLS}
      >
        {allowAll && <option value="">{allLabel}</option>}
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <PiCaretDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
    </div>
  );
}

// ─── Latest rates summary ─────────────────────────────────────────────────────

function LatestRatesCards() {
  const { latestRates, loading } = useExchangeRates();

  if (loading || latestRates.length === 0) return null;

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {latestRates.map((r) => (
        <div
          key={`${r.fromCurrency}-${r.toCurrency}`}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <PiTrendUp className="h-3.5 w-3.5 text-[#b20202]" />
            {r.fromCurrency} → {r.toCurrency}
          </div>
          <p className="mt-1.5 font-mono text-lg font-bold text-gray-900">
            {fmtRate(r.rate)}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            1 {r.fromCurrency} = {fmtRate(r.rate)} {r.toCurrency} ·{' '}
            {formatRateDate(r.effectiveDate)}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Converter widget ─────────────────────────────────────────────────────────

function ConverterCard() {
  const { getRate, loading } = useExchangeRates();
  const [amount, setAmount] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState<string>(BASE_CURRENCY);

  // Zero is a valid amount to convert; only empty / non-numeric is not.
  const parsed = Number(amount);
  const hasAmount = amount.trim() !== '' && Number.isFinite(parsed);
  const rate = getRate(from, to);
  const result = hasAmount && rate !== null ? parsed * rate : null;

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-800">
        <PiCurrencyCircleDollar className="h-4 w-4 text-[#b20202]" />
        Quick Converter
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-36">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Amount
          </label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLS}
          />
        </div>
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            From
          </label>
          <CurrencySelect value={from} onChange={setFrom} />
        </div>
        <button
          type="button"
          title="Swap currencies"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
          className="mb-1 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
        >
          <PiArrowsLeftRight className="h-4 w-4" />
        </button>
        <div className="w-28">
          <label className="mb-1 block text-xs font-medium text-gray-600">
            To
          </label>
          <CurrencySelect value={to} onChange={setTo} />
        </div>
        <div className="min-w-[180px] flex-1">
          {loading ? (
            <p className="text-sm text-gray-400">Loading rates…</p>
          ) : !hasAmount ? (
            <p className="text-sm text-gray-400">Enter an amount</p>
          ) : result === null ? (
            <p className="text-sm font-medium text-amber-600">
              No active rate for {from} → {to}
            </p>
          ) : (
            <p className="text-base font-bold text-gray-900">
              {CURRENCY_SYMBOLS[to] ?? to}
              {fmtMoney(result)}
              <span className="ml-2 text-xs font-normal text-gray-400">
                @ {fmtRate(rate!)}
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Latest-rate cards + quick converter. Both read the shared
 * useExchangeRates cache, so mounting these costs no extra requests.
 */
export function ExchangeRatesWidgets() {
  return (
    <>
      <LatestRatesCards />
      <ConverterCard />
    </>
  );
}
