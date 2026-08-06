// Nigerian Naira is the platform currency (DrinksHarbour is NGN throughout —
// see AGENTS.md). These values were hardcoded to USD, so every cart/checkout
// price rendered as $. They are now deployment-overridable via env, with NGN
// as the default.
const CURRENCY_CODE = process.env.NEXT_PUBLIC_CURRENCY_CODE || 'NGN';
const CURRENCY_LOCALE = process.env.NEXT_PUBLIC_CURRENCY_LOCALE || 'en-NG';

export function toCurrency(
  number: number | string,
  disableDecimal = false,
  decimalPlaces = 2
) {
  const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: CURRENCY_CODE,
    minimumFractionDigits: disableDecimal ? 0 : decimalPlaces,
    maximumFractionDigits: disableDecimal ? 0 : decimalPlaces,
  });
  return formatter.format(+number);
}
