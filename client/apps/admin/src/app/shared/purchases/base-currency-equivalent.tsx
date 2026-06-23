'use client';
import Link from 'next/link';
import { routes } from '@/config/routes';
import { useExchangeRates } from '@/hooks/use-exchange-rates';
import { BASE_CURRENCY, CURRENCY_SYMBOLS } from './types';

function fmtMoney(n: number) {
  return n.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Shows the NGN equivalent of a foreign-currency amount using the latest
 * active exchange rate. Renders nothing for NGN amounts; links to the
 * exchange-rates page when no rate is defined for the pair.
 */
export default function BaseCurrencyEquivalent({
  amount,
  currency,
  className = '',
}: {
  amount: number;
  currency?: string;
  className?: string;
}) {
  const { getRate, loading } = useExchangeRates();

  if (!currency || currency === BASE_CURRENCY || !amount || loading) {
    return null;
  }

  const rate = getRate(currency, BASE_CURRENCY);

  if (rate === null) {
    return (
      <Link
        href={routes.eCommerce.exchangeRates}
        className={`inline-flex items-center gap-1 text-xs font-medium text-amber-600 underline-offset-2 hover:underline ${className}`}
      >
        No {currency}→{BASE_CURRENCY} rate — set one
      </Link>
    );
  }

  return (
    <span className={`text-xs text-gray-500 ${className}`}>
      ≈ {CURRENCY_SYMBOLS[BASE_CURRENCY]}
      {fmtMoney(amount * rate)}
      <span className="text-gray-400"> @ {rate.toLocaleString('en-NG')}</span>
    </span>
  );
}
